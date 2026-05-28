/**
 * AI Scoring Orchestrator
 *
 * Routes scoring requests to Gemini -> Azure OpenAI -> Copilot Studio -> local rule fallback
 * with transparent engine reporting and bullet-proof fallback.
 *
 * Every fallback carries a typed AIError reason so the UI shows the real cause
 * (model deprecated, quota exceeded, etc.) instead of swallowing to "local-rule".
 */
import { callGemini } from '../ai/gemini';
import { callAzureOpenAI } from '../ai/azure-openai';
import { parseAIJson } from '../ai/json-parse';
import { getAIEngineStatus, type AIEngine } from '../ai/config';
import { AIError, classifyError } from '../ai/errors';
import { scoreWithRules } from './rule-engine';
import type { CandidateScore } from './types';
import { logger } from '../logger';

export const SCORING_PROMPT_VERSION = '2026-05-29.v2';

const SCORING_SYSTEM_PROMPT = `You are an enterprise technical recruiter, solution architect, and benchmark evaluator.

Evaluate the candidate CV against the selected role benchmark.

Use only:
1. Full extracted resume text
2. Selected benchmark JSON
3. Scoring rubric (out of 100, weighted across 8 dimensions)
4. Red flag detector

STRICT RULES:
- Do not invent facts.
- Do not assume missing skills.
- If a skill is missing, say "Not found in CV".
- If evidence is unclear, say "Not clearly evidenced".
- Validate skills using project evidence, not only skill lists.
- Validate architect titles using design artifacts and ownership.
- Penalize skill stacking (long tool lists without project context).
- Penalize vague JD-style resumes.
- Ignore protected attributes (gender, age, race, religion, marital status, nationality).
- Return STRICT JSON only. No markdown. No commentary outside JSON.

Scoring rubric (sum to overallScore, max 100):
- years (10): total + relevant experience vs benchmark minimum
- primarySkillDepth (25): mandatory + primary skills with project evidence
- architectureArtifacts (20): HLD/LLD, governance, patterns ownership
- projectFootprint (15): production go-lives, enterprise scale, measurable outcomes
- leadership (10): team size led, mentoring, stakeholder management
- modernization (10): cloud, DevOps, CI/CD, IaC, AI/GenAI where relevant
- certifications (5): role-relevant certifications and continuous learning
- communication (5): resume clarity, quantified outcomes, no vague JD-language

Score bands:
- 85-100: ideal (fast-track)
- 70-84: strong (interview)
- 55-69: borderline (screening call)
- Below 55: reject

Output JSON shape (exact keys):
{
  "candidateName": "",
  "targetRole": "",
  "totalExperience": 0,
  "relevantExperience": 0,
  "overallScore": 0,
  "scoreBand": "ideal|strong|borderline|reject",
  "recommendation": "",
  "risk": "low|medium|high",
  "breakdown": { "years": 0, "primarySkillDepth": 0, "architectureArtifacts": 0, "projectFootprint": 0, "leadership": 0, "modernization": 0, "certifications": 0, "communication": 0 },
  "matchedSkills": [], "missingSkills": [], "partiallyEvidencedSkills": [],
  "matchedEvidence": [], "missingOrWeakEvidence": [],
  "redFlagsDetected": [], "strengths": [], "gaps": [],
  "interviewFocusAreas": [], "interviewQuestions": [],
  "finalSummary": ""
}`;

function buildScoringPrompt(benchmark: unknown, resumeText: string, candidateName: string | null): string {
  const maxResumeChars = 18000;
  const trimmed =
    resumeText.length > maxResumeChars
      ? resumeText.slice(0, maxResumeChars) + '\n[...truncated for length...]'
      : resumeText;
  return `${SCORING_SYSTEM_PROMPT}

BENCHMARK JSON:
${JSON.stringify(benchmark, null, 2)}

CANDIDATE NAME (best guess from CV): ${candidateName || 'Unknown'}

RESUME TEXT:
"""
${trimmed}
"""

Return JSON only.`;
}

export interface ScoringOutcome {
  result: CandidateScore;
  engine: AIEngine;
  modelUsed?: string;
  rawResponse?: string;
  errorMessage?: string;
  errorKind?: string;
  promptVersion: string;
}

export interface ScoreCandidateInput {
  benchmark: Record<string, unknown> & {
    roleTitle?: string;
    minExperience?: number;
    weights?: Record<string, number>;
    primarySkills?: string[];
    mandatorySkills?: string[];
    interviewQuestions?: string[];
    seniority?: string;
  };
  resumeText: string;
  candidateName: string | null;
  forceEngine?: AIEngine;
}

export async function scoreCandidate(opts: ScoreCandidateInput): Promise<ScoringOutcome> {
  const { benchmark, resumeText, candidateName, forceEngine } = opts;

  // Hard guard: refuse to confidently score if extraction was insufficient
  if (!resumeText || resumeText.length < 200) {
    const fallback = scoreWithRules({ resumeText: resumeText || '', candidateName, benchmark });
    fallback.finalSummary =
      `INSUFFICIENT EXTRACTION (${resumeText?.length || 0} chars). Cannot score confidently. ` + fallback.finalSummary;
    fallback.risk = 'high';
    fallback.redFlagsDetected.unshift('Insufficient resume text extracted - scoring is not reliable');
    return {
      result: fallback,
      engine: 'local-rule',
      errorMessage: 'Insufficient extracted text',
      errorKind: 'extraction_insufficient',
      promptVersion: SCORING_PROMPT_VERSION,
    };
  }

  const status = getAIEngineStatus();
  const engine = forceEngine || status.preferredEngine;
  const prompt = buildScoringPrompt(benchmark, resumeText, candidateName);

  // Try AI path
  if (engine === 'gemini' || engine === 'azure-openai') {
    try {
      const { text: raw, model } = engine === 'gemini' ? await callGemini(prompt) : await callAzureOpenAI(prompt);
      const parsed = parseAIJson<Record<string, unknown>>(raw);
      if (parsed && typeof parsed.overallScore === 'number') {
        const normalized = normalizeAIScore(parsed, benchmark, candidateName);
        return {
          result: normalized,
          engine,
          modelUsed: model,
          rawResponse: raw,
          promptVersion: SCORING_PROMPT_VERSION,
        };
      }
      const fb = scoreWithRules({ resumeText, candidateName, benchmark });
      fb.finalSummary = `[AI returned invalid JSON - fell back to rule engine] ` + fb.finalSummary;
      logger.warn('AI returned invalid JSON', { engine, candidateName, rawLength: raw.length });
      return {
        result: fb,
        engine: 'local-fallback-ai-error',
        modelUsed: model,
        rawResponse: raw,
        errorMessage: 'AI returned invalid JSON',
        errorKind: 'invalid_json',
        promptVersion: SCORING_PROMPT_VERSION,
      };
    } catch (err) {
      const aiErr: AIError =
        err instanceof AIError ? err : classifyError(engine === 'gemini' ? 'gemini' : 'azure-openai', err);
      const fb = scoreWithRules({ resumeText, candidateName, benchmark });
      const hint = aiErr.hint ? ` Hint: ${aiErr.hint}` : '';
      fb.finalSummary =
        `[AI call failed (${aiErr.kind}): ${aiErr.message.slice(0, 240)}${hint} - fell back to rule engine] ` +
        fb.finalSummary;
      logger.error('AI call failed, falling back to rule engine', {
        engine,
        kind: aiErr.kind,
        provider: aiErr.provider,
        message: aiErr.message,
      });
      return {
        result: fb,
        engine: 'local-fallback-ai-error',
        errorMessage: aiErr.message,
        errorKind: aiErr.kind,
        promptVersion: SCORING_PROMPT_VERSION,
      };
    }
  }

  // Default: local rule engine
  const result = scoreWithRules({ resumeText, candidateName, benchmark });
  return { result, engine: 'local-rule', promptVersion: SCORING_PROMPT_VERSION };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function normalizeAIScore(
  ai: Record<string, unknown>,
  benchmark: ScoreCandidateInput['benchmark'],
  candidateName: string | null,
): CandidateScore {
  const weights = (benchmark.weights as Record<string, number>) || {
    years: 10,
    primarySkillDepth: 25,
    architectureArtifacts: 20,
    projectFootprint: 15,
    leadership: 10,
    modernization: 10,
    certifications: 5,
    communication: 5,
  };

  const b = (ai.breakdown as Record<string, number>) || {};
  // Clamp every component to its weight (prevents the AI from inflating individual dims).
  const breakdown = {
    years: clamp(Number(b.years ?? 0), 0, weights.years ?? 10),
    primarySkillDepth: clamp(Number(b.primarySkillDepth ?? 0), 0, weights.primarySkillDepth ?? 25),
    architectureArtifacts: clamp(Number(b.architectureArtifacts ?? 0), 0, weights.architectureArtifacts ?? 20),
    projectFootprint: clamp(Number(b.projectFootprint ?? 0), 0, weights.projectFootprint ?? 15),
    leadership: clamp(Number(b.leadership ?? 0), 0, weights.leadership ?? 10),
    modernization: clamp(Number(b.modernization ?? 0), 0, weights.modernization ?? 10),
    certifications: clamp(Number(b.certifications ?? 0), 0, weights.certifications ?? 5),
    communication: clamp(Number(b.communication ?? 0), 0, weights.communication ?? 5),
  };

  const sum = Object.values(breakdown).reduce((a, c) => a + c, 0);
  const claimedOverall = Number(ai.overallScore ?? 0);
  // If the AI's overall is wildly off the clamped sum (>5 points), trust the clamped sum.
  const overall = Math.abs(claimedOverall - sum) > 5 ? sum : clamp(claimedOverall, 0, 100);

  let band = ai.scoreBand as CandidateScore['scoreBand'];
  if (!['ideal', 'strong', 'borderline', 'reject'].includes(band)) {
    if (overall >= 85) band = 'ideal';
    else if (overall >= 70) band = 'strong';
    else if (overall >= 55) band = 'borderline';
    else band = 'reject';
  }

  const arrayOr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const riskRaw = ai.risk;
  const risk: CandidateScore['risk'] =
    riskRaw === 'low' || riskRaw === 'medium' || riskRaw === 'high' ? riskRaw : 'medium';

  return {
    candidateName: String(ai.candidateName || candidateName || 'Unknown Candidate'),
    targetRole: String(ai.targetRole || benchmark.roleTitle || 'Unknown'),
    totalExperience: Number(ai.totalExperience ?? 0),
    relevantExperience: Number(ai.relevantExperience ?? 0),
    overallScore: Math.round(overall),
    scoreBand: band,
    recommendation: String(ai.recommendation || (overall >= 70 ? 'Interview' : 'Screening call')),
    risk,
    breakdown,
    matchedSkills: arrayOr<string>(ai.matchedSkills, []),
    missingSkills: arrayOr<string>(ai.missingSkills, []),
    partiallyEvidencedSkills: arrayOr<string>(ai.partiallyEvidencedSkills, []),
    matchedEvidence: arrayOr<string>(ai.matchedEvidence, []),
    missingOrWeakEvidence: arrayOr<string>(ai.missingOrWeakEvidence, []),
    redFlagsDetected: arrayOr<string>(ai.redFlagsDetected, []),
    strengths: arrayOr<string>(ai.strengths, []),
    gaps: arrayOr<string>(ai.gaps, []),
    interviewFocusAreas: arrayOr<string>(ai.interviewFocusAreas, []),
    interviewQuestions: arrayOr<string>(ai.interviewQuestions, benchmark.interviewQuestions || []),
    finalSummary: String(ai.finalSummary || 'AI-generated summary unavailable.'),
  };
}
