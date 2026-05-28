/**
 * Resume Extraction Pipeline
 * Handles PDF, DOCX, TXT with transparent status reporting.
 * Optional OCR via Azure Document Intelligence when configured.
 * Never lies about what was extracted.
 */
import { env } from '../env';
import { logger } from '../logger';

export type ExtractionStatus = 'success' | 'partial' | 'failed' | 'ocr_required' | 'password_protected' | 'unsupported';

export interface ExtractionResult {
  text: string;
  charCount: number;
  status: ExtractionStatus;
  ocrUsed: boolean;
  ocrRequired: boolean;
  error?: string;
  warnings: string[];
}

export async function extractFromBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split('.').pop() || '';

  try {
    if (ext === 'txt' || mimeType.includes('text/plain')) {
      const text = buffer.toString('utf-8').trim();
      return {
        text,
        charCount: text.length,
        status: text.length > 100 ? 'success' : 'partial',
        ocrUsed: false,
        ocrRequired: false,
        warnings: text.length < 100 ? ['Very low character count - extraction may be incomplete'] : [],
      };
    }

    if (ext === 'docx' || mimeType.includes('officedocument.wordprocessingml')) {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      if (result.messages?.length) warnings.push(...result.messages.slice(0, 3).map((m) => m.message));
      return {
        text,
        charCount: text.length,
        status: text.length > 200 ? 'success' : text.length > 0 ? 'partial' : 'failed',
        ocrUsed: false,
        ocrRequired: false,
        warnings,
      };
    }

    if (ext === 'pdf' || mimeType.includes('pdf')) {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule.default ?? pdfParseModule) as (b: Buffer) => Promise<{ text: string }>;
      try {
        const result = await pdfParse(buffer);
        const text = (result.text || '').trim();
        if (!text || text.length < 100) {
          // Likely scanned/image-based PDF -> try OCR if configured.
          const ocrText = await tryOCR(buffer);
          if (ocrText && ocrText.length >= 100) {
            return {
              text: ocrText,
              charCount: ocrText.length,
              status: 'success',
              ocrUsed: true,
              ocrRequired: true,
              warnings: ['Used Azure Document Intelligence OCR for scanned PDF'],
            };
          }
          return {
            text: text || '',
            charCount: text.length,
            status: 'ocr_required',
            ocrUsed: false,
            ocrRequired: true,
            warnings: [
              ocrText
                ? 'PDF appears scanned; OCR returned insufficient text.'
                : 'PDF appears scanned/image-based. Configure AZURE_DOC_INTELLIGENCE_* to enable OCR.',
            ],
          };
        }
        return {
          text,
          charCount: text.length,
          status: 'success',
          ocrUsed: false,
          ocrRequired: false,
          warnings,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
          return {
            text: '',
            charCount: 0,
            status: 'password_protected',
            ocrUsed: false,
            ocrRequired: false,
            error: 'PDF is password-protected',
            warnings: ['Cannot read password-protected PDFs'],
          };
        }
        return {
          text: '',
          charCount: 0,
          status: 'failed',
          ocrUsed: false,
          ocrRequired: false,
          error: msg,
          warnings: ['PDF parsing failed - file may be corrupted'],
        };
      }
    }

    return {
      text: '',
      charCount: 0,
      status: 'unsupported',
      ocrUsed: false,
      ocrRequired: false,
      error: `Unsupported file type: ${ext}`,
      warnings: ['Only PDF, DOCX, TXT are supported'],
    };
  } catch (e: unknown) {
    return {
      text: '',
      charCount: 0,
      status: 'failed',
      ocrUsed: false,
      ocrRequired: false,
      error: e instanceof Error ? e.message : String(e),
      warnings: ['Extraction pipeline error'],
    };
  }
}

/** Calls Azure Document Intelligence "prebuilt-read" model. Returns null on any failure / not configured. */
async function tryOCR(buffer: Buffer): Promise<string | null> {
  const endpoint = env().AZURE_DOC_INTELLIGENCE_ENDPOINT;
  const key = env().AZURE_DOC_INTELLIGENCE_KEY;
  if (!endpoint || !key) return null;

  try {
    const submit = await fetch(
      `${endpoint.replace(/\/$/, '')}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': key,
        },
        body: new Uint8Array(buffer),
      },
    );
    if (!submit.ok) {
      logger.warn('Document Intelligence submit failed', { status: submit.status });
      return null;
    }
    const operationLocation = submit.headers.get('operation-location');
    if (!operationLocation) return null;

    // Poll
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(operationLocation, { headers: { 'Ocp-Apim-Subscription-Key': key } });
      if (!poll.ok) continue;
      const data = (await poll.json()) as { status?: string; analyzeResult?: { content?: string } };
      if (data.status === 'succeeded') return data.analyzeResult?.content?.trim() || null;
      if (data.status === 'failed') return null;
    }
    return null;
  } catch (e) {
    logger.warn('OCR call threw', { error: String(e) });
    return null;
  }
}

/** Best-effort candidate name extractor. Looks at the first 12 lines for a Title-Case name. */
export function guessCandidateName(text: string): string | null {
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Strategy 1: classic Title-Case line near the top.
  const TITLECASE = /^([A-Z][a-z'`-]+(?:\s+[A-Z][a-z'`-]+){1,4})$/;
  for (const line of lines.slice(0, 8)) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 4 || cleaned.length > 60) continue;
    if (/(curriculum|resume|cv|profile)/i.test(cleaned)) continue;
    if (TITLECASE.test(cleaned)) return cleaned;
  }

  // Strategy 2: line that contains a name then a phone/email -> strip after first digit/@
  for (const line of lines.slice(0, 8)) {
    const head = line.split(/[\d@(]/)[0]?.trim();
    if (!head) continue;
    if (head.length < 4 || head.length > 60) continue;
    if (/(curriculum|resume|cv|profile)/i.test(head)) continue;
    if (TITLECASE.test(head)) return head;
  }

  // Strategy 3: derive from email local-part (john.doe@x.com -> John Doe).
  const emailMatch = text.match(/[a-zA-Z][a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const local = emailMatch[0].split('@')[0]!;
    const parts = local.split(/[._-]/).filter((p) => p.length > 1 && /^[a-zA-Z]+$/.test(p));
    if (parts.length >= 2) {
      return parts
        .slice(0, 3)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}

export function guessEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

export function guessPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  return m ? m[0] : null;
}
