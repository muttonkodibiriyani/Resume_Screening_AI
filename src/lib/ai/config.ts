/**
 * AI Engine Configuration & Mode Detection
 * Transparent — never lies about which engine is active.
 */

export type AIEngine =
  | 'gemini'
  | 'azure-openai'
  | 'gemini+search'
  | 'azure+search'
  | 'copilot-studio'
  | 'local-rule'
  | 'local-fallback-ai-error';

export interface AIEngineStatus {
  geminiConfigured: boolean;
  azureOpenAIConfigured: boolean;
  searchConfigured: boolean;
  ocrConfigured: boolean;
  copilotStudioConfigured: boolean;
  pdfExtractionEnabled: boolean;
  preferredEngine: AIEngine;
  preferredEngineForBenchmark: AIEngine;
  modeLabel: string;
}

export function getAIEngineStatus(): AIEngineStatus {
  const geminiConfigured = !!process.env.GOOGLE_GEMINI_API_KEY;
  const azureOpenAIConfigured = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
  const searchConfigured = !!process.env.TAVILY_API_KEY;
  const ocrConfigured = !!(process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOC_INTELLIGENCE_KEY);
  const copilotStudioConfigured = !!process.env.COPILOT_STUDIO_WEBHOOK_URL;

  // Scoring engine preference: Gemini > Azure > local-rule
  let preferredEngine: AIEngine = 'local-rule';
  if (geminiConfigured) preferredEngine = 'gemini';
  else if (azureOpenAIConfigured) preferredEngine = 'azure-openai';
  else if (copilotStudioConfigured) preferredEngine = 'copilot-studio';

  // Benchmark generation engine preference: AI + search > AI only > local
  let preferredEngineForBenchmark: AIEngine = 'local-rule';
  if (geminiConfigured && searchConfigured) preferredEngineForBenchmark = 'gemini+search';
  else if (azureOpenAIConfigured && searchConfigured) preferredEngineForBenchmark = 'azure+search';
  else if (geminiConfigured) preferredEngineForBenchmark = 'gemini';
  else if (azureOpenAIConfigured) preferredEngineForBenchmark = 'azure-openai';

  const modeLabel = engineToLabel(preferredEngine);

  return {
    geminiConfigured, azureOpenAIConfigured, searchConfigured, ocrConfigured,
    copilotStudioConfigured, pdfExtractionEnabled: true,
    preferredEngine, preferredEngineForBenchmark, modeLabel,
  };
}

export function engineToLabel(engine: AIEngine): string {
  switch (engine) {
    case 'gemini': return 'Google Gemini';
    case 'azure-openai': return 'Azure OpenAI';
    case 'gemini+search': return 'Google Gemini + Online Search';
    case 'azure+search': return 'Azure OpenAI + Online Search';
    case 'copilot-studio': return 'Copilot Studio';
    case 'local-rule': return 'LOCAL FALLBACK (rule-based)';
    case 'local-fallback-ai-error': return 'LOCAL FALLBACK (AI error)';
  }
}

export function engineBadgeColor(engine: AIEngine): string {
  if (engine.includes('local')) return 'amber';
  if (engine === 'gemini' || engine === 'gemini+search') return 'blue';
  if (engine === 'azure-openai' || engine === 'azure+search') return 'indigo';
  if (engine === 'copilot-studio') return 'purple';
  return 'slate';
}
