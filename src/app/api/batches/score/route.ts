/**
 * Batch scoring endpoint for Power Automate / Copilot Studio integration.
 *
 * - Server-to-server only: authenticates with a pre-shared bearer token
 *   (POWER_AUTOMATE_API_KEY) instead of a session cookie. CSRF is therefore
 *   bypassed in src/lib/api.ts for this exact path.
 * - JSON-in / JSON-out (no multipart). Files arrive as base64-encoded payloads
 *   produced by the SharePoint "Get file content" connector in Power Automate.
 * - Reuses the existing extractFromBuffer + scoreCandidate pipeline so the
 *   results are byte-for-byte identical to what the web UI produces.
 * - Returns a flat, Dataverse-friendly shape (one row per candidate) so the
 *   Power Automate "Parse JSON -> Apply to each -> Add Dataverse row" pattern
 *   works without any further transformation.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler, parseJson, verifyBearerToken } from '@/lib/api';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db';
import { extractFromBuffer, guessCandidateName, guessEmail, guessPhone } from '@/lib/extraction/extractor';
import { scoreCandidate, SCORING_PROMPT_VERSION } from '@/lib/scoring/ai-engine';
import { saveResume } from '@/lib/storage';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { jsonParse } from '@/lib/utils';
import { FILE_LIMITS } from '@/lib/validation/schemas';

// One batch may contain many resumes; keep the lambda alive while we score them.
export const maxDuration = 300;

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  base64: z.string().min(16),
  contentType: z.string().optional(),
});

const bodySchema = z.object({
  benchmarkId: z.string().min(1),
  /** Optional: identifies the Power Automate batch row so the response can echo it back. */
  batchId: z.string().optional(),
  files: z.array(fileSchema).min(1).max(FILE_LIMITS.maxFiles),
});

interface ScoredRow {
  candidateId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  fileName: string;
  totalScore: number | null;
  scoreBand: string | null;
  decision: 'shortlist' | 'hold' | 'reject' | 'error';
  reasoning: string;
  aiEngine: string | null;
  modelUsed: string | null;
  error?: string;
}

/** Bucket the numeric score into a recruiter-friendly decision. */
function decideFromScore(score: number): 'shortlist' | 'hold' | 'reject' {
  if (score >= 75) return 'shortlist';
  if (score >= 50) return 'hold';
  return 'reject';
}

async function sha256Hex(buf: Buffer): Promise<string> {
  const view = new Uint8Array(buf.byteLength);
  view.set(buf);
  const digest = await crypto.subtle.digest('SHA-256', view);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

export const POST = apiHandler(async (req: NextRequest) => {
  // 1) Authenticate via pre-shared bearer token.
  const expected = env().POWER_AUTOMATE_API_KEY;
  if (!expected) {
    return NextResponse.json(
      {
        error: 'Batch endpoint is not configured on this server',
        code: 'BATCH_NOT_CONFIGURED',
        hint: 'Set POWER_AUTOMATE_API_KEY in App Service / Key Vault to enable this route.',
      },
      { status: 503 },
    );
  }
  if (!verifyBearerToken(req, expected)) {
    return NextResponse.json({ error: 'Missing or invalid bearer token', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 2) Parse and validate the payload.
  const { benchmarkId, batchId, files } = await parseJson(req, bodySchema);

  // 3) Load the benchmark and pre-build the scoring context (once per batch).
  const benchmark = await prisma.benchmark.findUnique({ where: { id: benchmarkId } });
  if (!benchmark) {
    return NextResponse.json({ error: 'Benchmark not found', code: 'NOT_FOUND' }, { status: 404 });
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
  const scored: ScoredRow[] = [];

  // 4) Score each file sequentially. Power Automate already throttles upstream;
  //    we keep this serial so a slow Gemini call doesn't fan out into 30 parallel
  //    requests that hit rate limits.
  for (const f of files) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(f.base64, 'base64');
    } catch {
      scored.push({
        candidateId: null,
        name: null,
        email: null,
        phone: null,
        fileName: f.name,
        totalScore: null,
        scoreBand: null,
        decision: 'error',
        reasoning: '',
        aiEngine: null,
        modelUsed: null,
        error: 'Invalid base64 payload',
      });
      continue;
    }
    if (buffer.byteLength > FILE_LIMITS.maxBytesPerFile) {
      scored.push({
        candidateId: null,
        name: null,
        email: null,
        phone: null,
        fileName: f.name,
        totalScore: null,
        scoreBand: null,
        decision: 'error',
        reasoning: '',
        aiEngine: null,
        modelUsed: null,
        error: `File exceeds ${FILE_LIMITS.maxBytesPerFile / 1024 / 1024} MB limit`,
      });
      continue;
    }

    try {
      const extraction = await extractFromBuffer(buffer, f.name, f.contentType ?? 'application/octet-stream');
      const candidateName = guessCandidateName(extraction.text);
      const email = guessEmail(extraction.text);
      const phone = guessPhone(extraction.text);

      const sha = (await sha256Hex(buffer)).slice(0, 16);
      const storage = await saveResume({
        buffer,
        fileName: f.name,
        contentType: f.contentType || 'application/octet-stream',
        sha,
      });

      const created = await prisma.candidate.create({
        data: {
          benchmarkId,
          candidateName,
          email,
          phone,
          fileName: f.name,
          fileType: f.contentType || 'unknown',
          fileSize: buffer.byteLength,
          filePath: storage.path,
          extractedText: extraction.text,
          extractedChars: extraction.charCount,
          extractionStatus: extraction.status,
          ocrUsed: extraction.ocrUsed,
          extractionError: extraction.error ?? null,
        },
      });

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
        userId: 'power-automate',
        action: 'BATCH_SCORED',
        entityType: 'Candidate',
        entityId: created.id,
        details: {
          batchId,
          engine: scoring.engine,
          model: scoring.modelUsed,
          score: scoring.result.overallScore,
          band: scoring.result.scoreBand,
        },
        ipAddress: ip,
      });

      scored.push({
        candidateId: created.id,
        name: candidateName,
        email,
        phone,
        fileName: f.name,
        totalScore: Math.round(scoring.result.overallScore * 100) / 100,
        scoreBand: scoring.result.scoreBand,
        decision: decideFromScore(scoring.result.overallScore),
        reasoning: scoring.result.finalSummary.slice(0, 1500),
        aiEngine: scoring.engine,
        modelUsed: scoring.modelUsed ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scored.push({
        candidateId: null,
        name: null,
        email: null,
        phone: null,
        fileName: f.name,
        totalScore: null,
        scoreBand: null,
        decision: 'error',
        reasoning: '',
        aiEngine: null,
        modelUsed: null,
        error: message,
      });
      await logAudit({
        userId: 'power-automate',
        action: 'BATCH_PROCESSING_FAILED',
        entityType: 'Candidate',
        details: { batchId, fileName: f.name, error: message },
        ipAddress: ip,
      });
    }
  }

  const summary = {
    shortlist: scored.filter((s) => s.decision === 'shortlist').length,
    hold: scored.filter((s) => s.decision === 'hold').length,
    reject: scored.filter((s) => s.decision === 'reject').length,
    errors: scored.filter((s) => s.decision === 'error').length,
  };

  return NextResponse.json({
    batchId: batchId ?? null,
    benchmarkId,
    roleTitle: benchmark.roleTitle,
    scoredCount: scored.length,
    summary,
    scored,
  });
});
