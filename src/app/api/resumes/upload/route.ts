/**
 * Streamed resume upload + scoring.
 *
 * - Authenticated + RBAC + per-user rate-limited.
 * - Server-side MIME sniffing (file-type) with allow-list.
 * - Per-file Prisma transaction so partial failures don't orphan rows.
 * - Bounded concurrency (3 files at a time) so a 50-file batch doesn't DDoS Gemini.
 * - NDJSON stream so the UI can show real per-file progress instead of fake setTimeouts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { extractFromBuffer, guessCandidateName, guessEmail, guessPhone } from '@/lib/extraction/extractor';
import { scoreCandidate, SCORING_PROMPT_VERSION } from '@/lib/scoring/ai-engine';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { FILE_LIMITS } from '@/lib/validation/schemas';
import { saveResume } from '@/lib/storage';
import { jsonParse } from '@/lib/utils';
import { fileTypeFromBuffer } from 'file-type';

/** Web-Crypto SHA-256 hex digest. Works in Node (>=16) and Edge runtimes. */
async function sha256Hex(buf: Buffer): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the BufferSource
  // typing of `crypto.subtle.digest` is happy (Node Buffer's backing
  // ArrayBufferLike may be SharedArrayBuffer in some environments).
  const view = new Uint8Array(buf.byteLength);
  view.set(buf);
  const digest = await crypto.subtle.digest('SHA-256', view);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

export const maxDuration = 300; // 5 minutes; the streaming response keeps the connection alive

interface ProgressEvent {
  type: 'queued' | 'extracting' | 'extracted' | 'scoring' | 'done' | 'error';
  index: number;
  fileName: string;
  candidateId?: string;
  candidateName?: string;
  engine?: string;
  modelUsed?: string;
  score?: number;
  band?: string;
  extraction?: { status: string; charCount: number };
  error?: string;
}

async function validateFile(
  file: File,
): Promise<{ ok: true; buffer: Buffer; ext: string } | { ok: false; reason: string }> {
  if (file.size > FILE_LIMITS.maxBytesPerFile) {
    return { ok: false, reason: `File exceeds ${FILE_LIMITS.maxBytesPerFile / 1024 / 1024} MB limit` };
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  const ext = ('.' +
    (file.name.split('.').pop() || '').toLowerCase()) as (typeof FILE_LIMITS.allowedExtensions)[number];
  if (!FILE_LIMITS.allowedExtensions.includes(ext)) {
    return { ok: false, reason: `Extension ${ext} not allowed (allowed: ${FILE_LIMITS.allowedExtensions.join(', ')})` };
  }

  // Sniff real MIME (TXT often has no magic bytes -> trust extension only for .txt).
  if (ext !== '.txt') {
    const sniffed = await fileTypeFromBuffer(buffer);
    if (!sniffed) return { ok: false, reason: 'Unable to detect file type from contents' };
    const allowed =
      (ext === '.pdf' && sniffed.mime === 'application/pdf') ||
      (ext === '.docx' && sniffed.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (!allowed) return { ok: false, reason: `File contents (${sniffed.mime}) do not match extension ${ext}` };
  }

  return { ok: true, buffer, ext };
}

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requirePermission('candidate:upload');

  const rl = rateLimit(user.id, LIMITS.uploadFiles);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Upload rate limit exceeded', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  const formData = await req.formData();
  const benchmarkId = formData.get('benchmarkId');
  if (typeof benchmarkId !== 'string' || !benchmarkId) {
    return NextResponse.json({ error: 'benchmarkId is required' }, { status: 400 });
  }

  const benchmark = await prisma.benchmark.findUnique({ where: { id: benchmarkId } });
  if (!benchmark) return NextResponse.json({ error: 'Benchmark not found', code: 'NOT_FOUND' }, { status: 404 });

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  if (files.length > FILE_LIMITS.maxFiles) {
    return NextResponse.json({ error: `Max ${FILE_LIMITS.maxFiles} files per request` }, { status: 400 });
  }

  const benchmarkObj = {
    roleTitle: benchmark.roleTitle,
    skillFamily: benchmark.skillFamily,
    seniority: benchmark.seniority,
    minExperience: benchmark.minExperience,
    primarySkills: jsonParse<string[]>(benchmark.primarySkills, []),
    mandatorySkills: jsonParse<string[]>(benchmark.mandatorySkills, []),
    goodToHaveSkills: jsonParse<string[]>(benchmark.goodToHaveSkills, []),
    technicalDepthIndicators: jsonParse<string[]>(benchmark.technicalDepth, []),
    redFlags: jsonParse<string[]>(benchmark.redFlags, []),
    weights: jsonParse<Record<string, number>>(benchmark.weights, {}),
    interviewQuestions: jsonParse<string[]>(benchmark.interviewQuestions, []),
  };

  const ip = callerIp();

  // Bounded concurrency (3 files in flight). Avoids saturating Gemini at 30+ files.
  const CONCURRENCY = 3;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: ProgressEvent): void => {
    controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
  };

  const stream = new ReadableStream({
    async start(controller) {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
        while (cursor < files.length) {
          const index = cursor++;
          const file = files[index]!;

          send(controller, { type: 'queued', index, fileName: file.name });

          try {
            const validation = await validateFile(file);
            if (!validation.ok) {
              send(controller, { type: 'error', index, fileName: file.name, error: validation.reason });
              await logAudit({
                userId: user.id,
                action: 'RESUME_REJECTED',
                entityType: 'Candidate',
                details: { fileName: file.name, reason: validation.reason },
                ipAddress: ip,
              });
              continue;
            }
            const { buffer } = validation;

            send(controller, { type: 'extracting', index, fileName: file.name });
            const extraction = await extractFromBuffer(buffer, file.name, file.type);

            const candidateName = guessCandidateName(extraction.text);
            const email = guessEmail(extraction.text);
            const phone = guessPhone(extraction.text);

            // Persist original file
            const sha = (await sha256Hex(buffer)).slice(0, 16);
            const storage = await saveResume({
              buffer,
              fileName: file.name,
              contentType: file.type || 'application/octet-stream',
              sha,
            });

            send(controller, {
              type: 'extracted',
              index,
              fileName: file.name,
              candidateName: candidateName || undefined,
              extraction: { status: extraction.status, charCount: extraction.charCount },
            });

            const created = await prisma.$transaction(async (tx) => {
              const candidate = await tx.candidate.create({
                data: {
                  benchmarkId,
                  candidateName,
                  email,
                  phone,
                  fileName: file.name,
                  fileType: file.type || 'unknown',
                  fileSize: file.size,
                  filePath: storage.path,
                  extractedText: extraction.text,
                  extractedChars: extraction.charCount,
                  extractionStatus: extraction.status,
                  ocrUsed: extraction.ocrUsed,
                  extractionError: extraction.error ?? null,
                },
              });
              return candidate;
            });

            await logAudit({
              userId: user.id,
              action: 'RESUME_UPLOADED',
              entityType: 'Candidate',
              entityId: created.id,
              details: { fileName: file.name, status: extraction.status, chars: extraction.charCount, sha },
              ipAddress: ip,
            });

            send(controller, { type: 'scoring', index, fileName: file.name, candidateId: created.id });

            const scoring = await scoreCandidate({
              benchmark: benchmarkObj,
              resumeText: extraction.text,
              candidateName,
            });

            await prisma.scoreResult.create({
              data: {
                candidateId: created.id,
                totalExperience: scoring.result.totalExperience,
                relevantExperience: scoring.result.relevantExperience,
                overallScore: scoring.result.overallScore,
                scoreBand: scoring.result.scoreBand,
                recommendation: scoring.result.recommendation,
                risk: scoring.result.risk,
                aiEngine: scoring.engine,
                breakdown: JSON.stringify(scoring.result.breakdown),
                matchedSkills: JSON.stringify(scoring.result.matchedSkills),
                missingSkills: JSON.stringify(scoring.result.missingSkills),
                partiallyEvidenced: JSON.stringify(scoring.result.partiallyEvidencedSkills),
                matchedEvidence: JSON.stringify(scoring.result.matchedEvidence),
                missingEvidence: JSON.stringify(scoring.result.missingOrWeakEvidence),
                redFlagsDetected: JSON.stringify(scoring.result.redFlagsDetected),
                strengths: JSON.stringify(scoring.result.strengths),
                gaps: JSON.stringify(scoring.result.gaps),
                interviewFocusAreas: JSON.stringify(scoring.result.interviewFocusAreas),
                interviewQuestions: JSON.stringify(scoring.result.interviewQuestions),
                finalSummary: scoring.result.finalSummary,
                rawResponse: scoring.rawResponse?.slice(0, 8000) ?? null,
                errorMessage: scoring.errorMessage ?? null,
                modelUsed: scoring.modelUsed ?? null,
                promptVersion: SCORING_PROMPT_VERSION,
                weightsSnapshot: JSON.stringify(benchmark.weights),
                benchmarkVersionAtScore: benchmark.version,
              },
            });

            await logAudit({
              userId: user.id,
              action: 'AI_SCORED',
              entityType: 'Candidate',
              entityId: created.id,
              details: {
                engine: scoring.engine,
                model: scoring.modelUsed,
                score: scoring.result.overallScore,
                band: scoring.result.scoreBand,
                errorKind: scoring.errorKind,
              },
              ipAddress: ip,
            });

            send(controller, {
              type: 'done',
              index,
              fileName: file.name,
              candidateId: created.id,
              candidateName: candidateName || undefined,
              engine: scoring.engine,
              modelUsed: scoring.modelUsed,
              score: scoring.result.overallScore,
              band: scoring.result.scoreBand,
              extraction: { status: extraction.status, charCount: extraction.charCount },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send(controller, { type: 'error', index, fileName: file.name, error: message });
            await logAudit({
              userId: user.id,
              action: 'RESUME_PROCESSING_FAILED',
              entityType: 'Candidate',
              details: { fileName: file.name, error: message },
              ipAddress: ip,
            });
          }
        }
      });

      await Promise.all(workers);
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
});
