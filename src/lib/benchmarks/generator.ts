/**
 * Benchmark generation engine.
 * Modes:
 *   - ai-research: Gemini/Azure + Online Search (Tavily) — produces market-aware benchmark
 *   - ai-only: Gemini/Azure only — produces benchmark from AI reasoning + framework
 *   - local-fallback: deterministic template-based — no AI
 */
import { callGemini } from '../ai/gemini';
import { callAzureOpenAI } from '../ai/azure-openai';
import { searchWeb, SearchResult } from '../ai/search';
import { parseAIJson } from '../ai/json-parse';
import { getAIEngineStatus, AIEngine } from '../ai/config';
import { BENCHMARK_TEMPLATES, DEFAULT_WEIGHTS, findTemplateByRole } from './templates';
import { prisma } from '../db';
import { logger } from '../logger';
import { AIError } from '../ai/errors';

export const BENCHMARK_PROMPT_VERSION = '2026-05-29-v2';

const BENCHMARK_SYSTEM_PROMPT = `You are an expert enterprise hiring benchmark researcher for the TECHNOLOGY ORGANISATION of a Tier-1 retail enterprise (Alshaya).

SCOPE - YOU ONLY GENERATE BENCHMARKS FOR ROLES IN:
- Software engineering (frontend, backend, full-stack, mobile, embedded)
- Data / analytics / AI / ML / data engineering / BI
- Cloud / DevOps / SRE / platform / infrastructure
- Security / cyber / GRC / IAM
- Architecture / enterprise architecture / solution architecture
- Product / programme / project management for tech delivery
- QA / SDET / test automation
- IT operations, networking, ERP / CRM / commerce technical roles (e.g. SAP, Salesforce, Oracle Retail technical specialists)

IF THE REQUESTED ROLE IS CLEARLY OUTSIDE THIS SCOPE (e.g. "Surgeon", "Chef", "Pilot", "Lawyer", "Sales clerk", "HR coordinator", "Marketing creative"), DO NOT INVENT A METAPHORICAL TECH EQUIVALENT. Instead return EXACTLY this JSON and nothing else:
{ "outOfScope": true, "reason": "This platform generates benchmarks for technology roles only. The requested role appears to be non-technical: <one-sentence reason>." }

TITLE PRESERVATION:
- The "roleTitle" field MUST be the user's input role title, normalized only for capitalisation and punctuation. DO NOT rewrite, embellish, or append parenthetical specialisations. Example: input "Backend Engineer" -> "Backend Engineer", NOT "Backend Engineer (Critical Microservices Specialist)".

GENERAL RULES:
- Output STRICT JSON only. No markdown. No commentary outside JSON.
- Be specific to the role and skill family. Avoid generic platitudes.
- Include real red flags that recruiters should watch for.
- Include weights summing to 100 across: years, primarySkillDepth, architectureArtifacts, projectFootprint, leadership, modernization, certifications, communication.
- Include 5-8 sharp interview questions.
- Populate "sources" when online research snippets are provided.
- Set "generationMode" to one of: "gemini", "azure-openai", "gemini+search", "azure+search", "local-rule".

JSON shape for a valid (in-scope) benchmark:
{
  "roleTitle": "", "skillFamily": "", "seniority": "", "minExperience": 0, "domainContext": "",
  "primarySkills": [], "mandatorySkills": [], "goodToHaveSkills": [],
  "technicalDepthIndicators": [], "functionalDomainIndicators": [],
  "architectureExpectations": [], "leadershipExpectations": [],
  "deliveryExpectations": [], "modernizationExpectations": [],
  "redFlags": [],
  "weights": { "years": 10, "primarySkillDepth": 25, "architectureArtifacts": 20, "projectFootprint": 15, "leadership": 10, "modernization": 10, "certifications": 5, "communication": 5 },
  "interviewQuestions": [],
  "idealCandidateSummary": "",
  "screeningNotes": [],
  "benchmarkSource": "ai-research|ai-only|local-fallback",
  "generationMode": "gemini|azure-openai|gemini+search|azure+search|local-rule",
  "sources": []
}`;

/** Thrown when the AI declines to generate because the requested role isn't a technology role. */
export class BenchmarkOutOfScopeError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'BenchmarkOutOfScopeError';
    this.reason = reason;
  }
}

async function recordAICall(args: {
  provider: 'gemini' | 'azure-openai';
  modelUsed?: string;
  ok: boolean;
  latencyMs: number;
  errorKind?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.aICall.create({
      data: {
        provider: args.provider,
        modelUsed: args.modelUsed ?? null,
        promptVersion: BENCHMARK_PROMPT_VERSION,
        purpose: 'benchmark_generation',
        ok: args.ok,
        latencyMs: args.latencyMs,
        errorKind: args.errorKind ?? null,
        errorMessage: args.errorMessage ?? null,
      },
    });
  } catch (e) {
    // Telemetry is best-effort; never break a successful generation because logging failed.
    logger.warn('aICall log (benchmark) failed', { error: String(e) });
  }
}

async function callEngine(
  engine: AIEngine,
  prompt: string,
): Promise<{ text: string; model: string; provider: 'gemini' | 'azure-openai' }> {
  const started = Date.now();
  const provider: 'gemini' | 'azure-openai' = engine.startsWith('gemini') ? 'gemini' : 'azure-openai';
  try {
    const res =
      provider === 'gemini'
        ? await callGemini(prompt, { maxTokens: 6000 })
        : await callAzureOpenAI(prompt, { maxTokens: 4000 });
    await recordAICall({ provider, modelUsed: res.model, ok: true, latencyMs: Date.now() - started });
    return { text: res.text, model: res.model, provider };
  } catch (err) {
    const ae = err instanceof AIError ? err : null;
    await recordAICall({
      provider,
      ok: false,
      latencyMs: Date.now() - started,
      errorKind: ae?.kind ?? 'unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function isOutOfScopePayload(p: Record<string, unknown> | null): p is { outOfScope: true; reason?: string } {
  return !!p && p.outOfScope === true;
}

export interface GenerateBenchmarkInput {
  roleTitle: string;
  skillFamily?: string;
  minExperience?: number;
  seniority?: string;
  domainContext?: string;
  hiringNotes?: string;
}

export interface GeneratedBenchmark {
  roleTitle: string;
  skillFamily: string;
  seniority: string;
  minExperience: number;
  domainContext: string;
  primarySkills: string[];
  mandatorySkills: string[];
  goodToHaveSkills: string[];
  technicalDepthIndicators: string[];
  functionalDomainIndicators: string[];
  architectureExpectations: string[];
  leadershipExpectations: string[];
  deliveryExpectations: string[];
  modernizationExpectations: string[];
  redFlags: string[];
  weights: Record<string, number>;
  interviewQuestions: string[];
  idealCandidateSummary?: string;
  idealSummary?: string;
  screeningNotes?: string[];
  benchmarkSource?: string;
  generationMode?: string;
  sources?: Array<{ title: string; url: string }>;
}

export interface GenerateBenchmarkOutput {
  benchmark: GeneratedBenchmark;
  engineUsed: AIEngine;
  benchmarkSource: 'ai-research' | 'ai-only' | 'local-fallback' | 'template';
  sources: SearchResult[];
  errorMessage?: string;
}

export async function generateBenchmark(input: GenerateBenchmarkInput): Promise<GenerateBenchmarkOutput> {
  const status = getAIEngineStatus();
  const preferred = status.preferredEngineForBenchmark;

  const userPrompt = `Generate the ideal candidate benchmark for:
Role title: ${input.roleTitle}
Skill family: ${input.skillFamily || 'Not specified'}
Minimum experience (years): ${input.minExperience ?? 'Use your best judgment'}
Seniority: ${input.seniority || 'Use your best judgment'}
Domain / business context: ${input.domainContext || 'Retail enterprise (Alshaya)'}
Hiring notes: ${input.hiringNotes || 'None'}

`;

  // AI + Search
  if (preferred === 'gemini+search' || preferred === 'azure+search') {
    try {
      const query = `${input.roleTitle} ${input.skillFamily || ''} ideal candidate skills certifications red flags 2026`;
      const sources = await searchWeb(query, 6);
      const sourceText =
        sources.length > 0
          ? '\nOnline research snippets:\n' +
            sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n')
          : '\nOnline research returned no results.';
      const fullPrompt = `${BENCHMARK_SYSTEM_PROMPT}\n\n${userPrompt}${sourceText}\n\nReturn JSON only.`;
      const { text: raw } = await callEngine(preferred, fullPrompt);
      const parsed = parseAIJson<Record<string, unknown>>(raw);
      if (isOutOfScopePayload(parsed)) {
        throw new BenchmarkOutOfScopeError(parsed.reason || 'Requested role is not a technology role.');
      }
      if (parsed) {
        return {
          benchmark: normalizeBenchmark(parsed, input, preferred, 'ai-research', sources),
          engineUsed: preferred,
          benchmarkSource: 'ai-research',
          sources,
        };
      }
    } catch (e) {
      if (e instanceof BenchmarkOutOfScopeError) throw e; // do not fall through silently
      // otherwise fall through to AI-only
    }
  }

  // AI only
  if (preferred === 'gemini' || preferred === 'azure-openai') {
    try {
      const fullPrompt = `${BENCHMARK_SYSTEM_PROMPT}\n\n${userPrompt}\n(No online search results available - use AI reasoning + internal framework.)\n\nReturn JSON only.`;
      const { text: raw } = await callEngine(preferred, fullPrompt);
      const parsed = parseAIJson<Record<string, unknown>>(raw);
      if (isOutOfScopePayload(parsed)) {
        throw new BenchmarkOutOfScopeError(parsed.reason || 'Requested role is not a technology role.');
      }
      if (parsed) {
        return {
          benchmark: normalizeBenchmark(parsed, input, preferred, 'ai-only', []),
          engineUsed: preferred,
          benchmarkSource: 'ai-only',
          sources: [],
        };
      }
    } catch (e) {
      if (e instanceof BenchmarkOutOfScopeError) throw e;
      // fall through to local
    }
  }

  // Local fallback - use template if matched, else build a generic benchmark
  const template = findTemplateByRole(input.roleTitle) || BENCHMARK_TEMPLATES[0]!;
  const benchmark: GeneratedBenchmark = {
    ...template,
    roleTitle: input.roleTitle,
    skillFamily: input.skillFamily || template.skillFamily,
    minExperience: input.minExperience ?? template.minExperience,
    seniority: input.seniority || template.seniority,
    domainContext: input.domainContext || template.domainContext,
    benchmarkSource: 'local-fallback',
    generationMode: 'local-rule',
    sources: [],
    idealCandidateSummary: template.idealSummary,
    idealSummary: template.idealSummary,
  };
  return { benchmark, engineUsed: 'local-rule', benchmarkSource: 'local-fallback', sources: [] };
}

function normalizeBenchmark(
  ai: Record<string, unknown>,
  input: GenerateBenchmarkInput,
  engine: AIEngine,
  source: 'ai-research' | 'ai-only',
  sources: SearchResult[],
): GeneratedBenchmark {
  const w = (ai.weights as Record<string, number>) || DEFAULT_WEIGHTS;
  // The user's input is the source of truth for the role title. If the AI
  // returns a different title we ignore it (otherwise Gemini sometimes
  // appends a parenthetical "(... Specialist)" that confuses recruiters).
  const userTitle = (input.roleTitle || '').trim();
  return {
    roleTitle: userTitle || String(ai.roleTitle || 'Untitled role'),
    skillFamily: String(ai.skillFamily || input.skillFamily || 'General'),
    seniority: String(ai.seniority || input.seniority || 'Senior'),
    minExperience: Number(ai.minExperience ?? input.minExperience ?? 5),
    domainContext: String(ai.domainContext || input.domainContext || 'Retail enterprise'),
    primarySkills: arr<string>(ai.primarySkills),
    mandatorySkills: arr<string>(ai.mandatorySkills),
    goodToHaveSkills: arr<string>(ai.goodToHaveSkills),
    technicalDepthIndicators: arr<string>(ai.technicalDepthIndicators),
    functionalDomainIndicators: arr<string>(ai.functionalDomainIndicators),
    architectureExpectations: arr<string>(ai.architectureExpectations),
    leadershipExpectations: arr<string>(ai.leadershipExpectations),
    deliveryExpectations: arr<string>(ai.deliveryExpectations),
    modernizationExpectations: arr<string>(ai.modernizationExpectations),
    redFlags: arr<string>(ai.redFlags),
    weights: {
      years: w.years ?? 10,
      primarySkillDepth: w.primarySkillDepth ?? 25,
      architectureArtifacts: w.architectureArtifacts ?? 20,
      projectFootprint: w.projectFootprint ?? 15,
      leadership: w.leadership ?? 10,
      modernization: w.modernization ?? 10,
      certifications: w.certifications ?? 5,
      communication: w.communication ?? 5,
    },
    interviewQuestions: arr<string>(ai.interviewQuestions),
    idealCandidateSummary: String(ai.idealCandidateSummary || ''),
    screeningNotes: arr<string>(ai.screeningNotes),
    benchmarkSource: source,
    generationMode: engine,
    sources: sources.map((s) => ({ title: s.title, url: s.url })),
  };
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
