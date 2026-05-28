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

const BENCHMARK_SYSTEM_PROMPT = `You are an expert enterprise hiring benchmark researcher and role definition specialist for a Tier-1 retail enterprise (Alshaya).

Your job: create a deep, opinionated, market-aware IDEAL CANDIDATE benchmark JSON for the requested role.

Use the internal benchmark framework (5 dimensions: technical depth, breadth & ecosystem, delivery footprint, leadership, modernization) and any provided online research snippets.

STRICT RULES:
- Output STRICT JSON only. No markdown. No commentary outside JSON.
- Be specific to the role and skill family. Avoid generic platitudes.
- Include real red flags that recruiters should watch for.
- Include weights summing to 100 across: years, primarySkillDepth, architectureArtifacts, projectFootprint, leadership, modernization, certifications, communication.
- Include 5-8 sharp interview questions.
- Clearly populate "sources" if online research was used.
- Set "generationMode" to one of: "gemini", "azure-openai", "gemini+search", "azure+search", "local-rule".

JSON shape:
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
      const sourceText = sources.length > 0
        ? '\nOnline research snippets:\n' + sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n')
        : '\nOnline research returned no results.';
      const fullPrompt = `${BENCHMARK_SYSTEM_PROMPT}\n\n${userPrompt}${sourceText}\n\nReturn JSON only.`;
      const { text: raw } = preferred === 'gemini+search'
        ? await callGemini(fullPrompt, { maxTokens: 6000 })
        : await callAzureOpenAI(fullPrompt, { maxTokens: 4000 });
      const parsed = parseAIJson<Record<string, unknown>>(raw);
      if (parsed) {
        return {
          benchmark: normalizeBenchmark(parsed, input, preferred, 'ai-research', sources),
          engineUsed: preferred, benchmarkSource: 'ai-research', sources,
        };
      }
    } catch {
      // fall through to AI-only
    }
  }

  // AI only
  if (preferred === 'gemini' || preferred === 'azure-openai') {
    try {
      const fullPrompt = `${BENCHMARK_SYSTEM_PROMPT}\n\n${userPrompt}\n(No online search results available - use AI reasoning + internal framework.)\n\nReturn JSON only.`;
      const { text: raw } = preferred === 'gemini'
        ? await callGemini(fullPrompt, { maxTokens: 6000 })
        : await callAzureOpenAI(fullPrompt, { maxTokens: 4000 });
      const parsed = parseAIJson<Record<string, unknown>>(raw);
      if (parsed) {
        return {
          benchmark: normalizeBenchmark(parsed, input, preferred, 'ai-only', []),
          engineUsed: preferred, benchmarkSource: 'ai-only', sources: [],
        };
      }
    } catch {
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
  return {
    roleTitle: String(ai.roleTitle || input.roleTitle),
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
