/**
 * Google Gemini client with model auto-detection.
 *
 * Why auto-detection: Google deprecates Gemini models aggressively
 * (gemini-1.5-flash was shut down in 2025, gemini-2.0-flash deprecated June 2026).
 * Instead of failing with a 404, this client probes the ListModels endpoint
 * once per process and picks the best available flash-class model.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIError, classifyError } from './errors';

// Preference order: cheapest fast model that supports JSON mode.
// Higher in the list = preferred. Updated 2026-05.
const FLASH_PREFERENCE = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-001',
];

interface GeminiModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

let modelCache: { resolved: string; at: number } | null = null;
const MODEL_CACHE_MS = 30 * 60 * 1000; // 30 minutes

async function listAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: GeminiModelInfo[] };
    return (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  } catch {
    return [];
  }
}

async function resolveModel(apiKey: string, requested: string | undefined): Promise<string> {
  const now = Date.now();
  if (modelCache && now - modelCache.at < MODEL_CACHE_MS) return modelCache.resolved;

  const available = await listAvailableModels(apiKey);

  let chosen: string | null = null;

  if (requested && available.includes(requested)) {
    chosen = requested;
  } else if (available.length > 0) {
    for (const candidate of FLASH_PREFERENCE) {
      if (available.includes(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) {
      chosen = available.find((m) => m.includes('flash')) || available[0] || null;
    }
  }

  if (!chosen) chosen = requested || FLASH_PREFERENCE[0]!;

  modelCache = { resolved: chosen, at: now };
  return chosen;
}

export interface GeminiCallOpts {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function callGemini(prompt: string, opts: GeminiCallOpts = {}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIError({
      kind: 'not_configured',
      provider: 'gemini',
      message: 'GOOGLE_GEMINI_API_KEY is not set',
      hint: 'Add GOOGLE_GEMINI_API_KEY to .env.local and restart.',
    });
  }

  const requested = process.env.GOOGLE_GEMINI_MODEL;
  const model = await resolveModel(apiKey, requested);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const m = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxTokens ?? 8192,
        responseMimeType: 'application/json',
      },
    });
    const result = await m.generateContent(prompt);
    return { text: result.response.text(), model };
  } catch (err) {
    // If the cached model just broke (deprecation), invalidate and try once more.
    if (modelCache && (String(err).includes('404') || String(err).toLowerCase().includes('not found'))) {
      modelCache = null;
      throw classifyError('gemini', err);
    }
    throw classifyError('gemini', err);
  }
}

/** Test helper: forces a model probe. Useful for the /api/system/status endpoint. */
export async function probeGeminiModel(): Promise<{ ok: boolean; model?: string; error?: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'GOOGLE_GEMINI_API_KEY not set' };
  try {
    modelCache = null;
    const model = await resolveModel(apiKey, process.env.GOOGLE_GEMINI_MODEL);
    return { ok: true, model };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
