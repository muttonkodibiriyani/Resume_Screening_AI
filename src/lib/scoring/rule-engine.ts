/**
 * Local rule-based scoring engine.
 *
 * Used in three situations:
 *   1. No AI provider is configured (transparent, deterministic baseline).
 *   2. AI call failed (network, quota, model deprecation) - graceful fallback.
 *   3. AI returned invalid JSON (we still need a usable score).
 *
 * Design principles:
 *   - Every dimension is explainable - we trace which keywords matched and why.
 *   - Weights come from the benchmark; defaults sum to 100.
 *   - No protected attributes are ever inspected.
 *   - Output shape is identical to the AI engine so downstream code is uniform.
 *
 * Detailed algorithm documentation: docs/SCORING_ALGORITHM.md
 */
import type { CandidateScore, ScoreBreakdown } from './types';

export interface RuleScoringInput {
  resumeText: string;
  candidateName: string | null;
  benchmark: {
    roleTitle?: string;
    minExperience?: number;
    primarySkills?: string[];
    mandatorySkills?: string[];
    weights?: Record<string, number>;
    interviewQuestions?: string[];
    seniority?: string;
  };
}

const ARCH_KEYWORDS = [
  'architect',
  'designed',
  'hld',
  'lld',
  'high-level design',
  'low-level design',
  'reference architecture',
  'governance',
  'pattern',
  'blueprint',
];
const LEADERSHIP_KEYWORDS = ['led', 'leading', 'managed', 'mentored', 'team of', 'reports', 'stakeholder'];
const DELIVERY_KEYWORDS = [
  'production',
  'go-live',
  'go live',
  'rolled out',
  'rollout',
  'delivered',
  'migrated',
  'launched',
  'enterprise scale',
  'global rollout',
];
const MODERN_KEYWORDS = [
  'cloud',
  'azure',
  'aws',
  'gcp',
  'ci/cd',
  'devops',
  'kubernetes',
  'docker',
  'terraform',
  'bicep',
  'iac',
  'genai',
  'llm',
  'rag',
  'github actions',
];
const CERT_KEYWORDS = [
  'certified',
  'certification',
  'aws certified',
  'azure certified',
  'oracle certified',
  'az-',
  'oca',
  'ocp',
];
const JD_VAGUE_KEYWORDS = ['responsible for', 'involved in', 'worked on', 'participated in'];

const MONTHS = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((acc, k) => acc + (lower.includes(k.toLowerCase()) ? 1 : 0), 0);
}

/**
 * Robust experience estimator. Priority order:
 *   1. Explicit "X+ years" / "X yrs" tokens close to the top of the CV.
 *   2. Sum of date ranges in work history (Jan 2018 - Present, 2015 - 2020).
 *   3. Spread of distinct years mentioned (fallback only).
 *
 * Capped at 40 years.
 */
export function estimateYears(text: string): number {
  const lower = text.toLowerCase();

  // 1. Explicit "X years"
  const yearMatches = Array.from(lower.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs)\b/g));
  if (yearMatches.length) {
    const max = yearMatches.reduce((acc, m) => Math.max(acc, parseInt(m[1]!, 10) || 0), 0);
    if (max > 0) return Math.min(max, 40);
  }

  // 2. Sum of date ranges
  const RANGE = new RegExp(
    `(?:${MONTHS}[a-z]*[\\s,]+)?(\\d{4})\\s*[\\u2013\\u2014\\-to]+\\s*(?:(?:${MONTHS}[a-z]*[\\s,]+)?(\\d{4})|present|current|now)`,
    'gi',
  );
  const matches = Array.from(lower.matchAll(RANGE));
  if (matches.length) {
    const thisYear = new Date().getUTCFullYear();
    let total = 0;
    for (const m of matches) {
      const start = parseInt(m[1]!, 10);
      const end = m[2] ? parseInt(m[2], 10) : thisYear;
      if (start && end && end >= start && start >= 1970 && end <= thisYear + 1) {
        total += end - start;
      }
    }
    if (total > 0) return Math.min(total, 40);
  }

  // 3. Year spread fallback
  const years = (text.match(/\b(19[9]\d|20[0-3]\d)\b/g) || []).map(Number);
  if (years.length >= 2) {
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    return Math.min(maxY - minY, 40);
  }
  return 0;
}

function findEvidence(text: string, skill: string): string | null {
  const sentences = text.split(/[.\n]/);
  const lower = skill.toLowerCase().split('(')[0]!.trim();
  for (const s of sentences) {
    if (s.toLowerCase().includes(lower)) {
      return s.trim().slice(0, 220);
    }
  }
  return null;
}

export function scoreWithRules(input: RuleScoringInput): CandidateScore {
  const { resumeText, candidateName, benchmark } = input;
  const text = resumeText || '';
  const textLower = text.toLowerCase();

  const primarySkills: string[] = benchmark.primarySkills || [];
  const mandatorySkills: string[] = benchmark.mandatorySkills || [];
  const allSkills = Array.from(new Set([...primarySkills, ...mandatorySkills]));

  const matched: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];
  const matchedEvidence: string[] = [];
  const missingEvidence: string[] = [];

  for (const skill of allSkills) {
    const cleaned = skill.toLowerCase().split('(')[0]!.trim();
    const tokens = cleaned.split(/[\s/,]+/).filter((t) => t.length > 2);
    const fullMatch = tokens.length > 0 && tokens.every((t) => textLower.includes(t));
    const anyMatch = tokens.some((t) => textLower.includes(t));
    if (fullMatch) {
      matched.push(skill);
      const ev = findEvidence(text, cleaned);
      if (ev) matchedEvidence.push(`${skill}: "${ev}"`);
    } else if (anyMatch) {
      partial.push(skill);
    } else {
      missing.push(skill);
      missingEvidence.push(`${skill}: Not found in CV`);
    }
  }

  const totalYears = estimateYears(text);
  const relevantYears = Math.max(0, totalYears - 2);
  const minExp = benchmark.minExperience || 5;

  const W: Record<string, number> = benchmark.weights || {
    years: 10,
    primarySkillDepth: 25,
    architectureArtifacts: 20,
    projectFootprint: 15,
    leadership: 10,
    modernization: 10,
    certifications: 5,
    communication: 5,
  };

  const yearsScore = Math.round((Math.min(totalYears, minExp + 5) / (minExp + 5)) * (W.years ?? 10));

  const skillMatchRatio = allSkills.length > 0 ? matched.length / allSkills.length : 0;
  const primarySkillDepthScore = Math.round(skillMatchRatio * (W.primarySkillDepth ?? 25));

  const archHits = countMatches(text, ARCH_KEYWORDS);
  const archScore = Math.round(Math.min(archHits / 4, 1) * (W.architectureArtifacts ?? 20));

  const deliveryHits = countMatches(text, DELIVERY_KEYWORDS);
  const projectScore = Math.round(Math.min(deliveryHits / 4, 1) * (W.projectFootprint ?? 15));

  const leadHits = countMatches(text, LEADERSHIP_KEYWORDS);
  const leadScore = Math.round(Math.min(leadHits / 3, 1) * (W.leadership ?? 10));

  const modernHits = countMatches(text, MODERN_KEYWORDS);
  const modernScore = Math.round(Math.min(modernHits / 4, 1) * (W.modernization ?? 10));

  const certHits = countMatches(text, CERT_KEYWORDS);
  const certScore = Math.round(Math.min(certHits / 2, 1) * (W.certifications ?? 5));

  const vagueHits = countMatches(text, JD_VAGUE_KEYWORDS);
  const hasDates = /\b(19[9]\d|20[0-3]\d)\b/.test(text);
  const length = text.length;
  let commScore = W.communication ?? 5;
  if (vagueHits > 5) commScore = Math.round(commScore * 0.5);
  if (!hasDates) commScore = Math.round(commScore * 0.5);
  if (length < 1500) commScore = Math.round(commScore * 0.7);

  const breakdown: ScoreBreakdown = {
    years: yearsScore,
    primarySkillDepth: primarySkillDepthScore,
    architectureArtifacts: archScore,
    projectFootprint: projectScore,
    leadership: leadScore,
    modernization: modernScore,
    certifications: certScore,
    communication: commScore,
  };

  const overall = Math.min(
    100,
    Object.values(breakdown).reduce((a, b) => a + b, 0),
  );

  const redFlags: string[] = [];
  if (textLower.includes('architect') && archHits < 2) {
    redFlags.push('Title inflation risk: claims "architect" but limited design/HLD/LLD evidence in CV');
  }
  if (totalYears >= 15 && leadHits < 2) {
    redFlags.push('Seniority mismatch: 15+ years but limited leadership signals');
  }
  if (vagueHits > 6) {
    redFlags.push('Resume quality risk: heavy use of vague JD-style language');
  }
  if (deliveryHits < 1) {
    redFlags.push('Delivery risk: no clear production/go-live evidence');
  }
  if (allSkills.length > 0 && matched.length < Math.max(2, Math.floor(allSkills.length * 0.3))) {
    redFlags.push('Skill mismatch: too few primary/mandatory skills evidenced');
  }
  if (missing.length > matched.length) {
    redFlags.push('Skill gap: more mandatory skills missing than matched');
  }

  let band: CandidateScore['scoreBand'] = 'reject';
  let recommendation = 'Below benchmark - reject';
  let risk: CandidateScore['risk'] = 'high';
  if (overall >= 85) {
    band = 'ideal';
    recommendation = 'Ideal candidate - fast-track to interview';
    risk = 'low';
  } else if (overall >= 70) {
    band = 'strong';
    recommendation = 'Strong candidate - schedule interview';
    risk = redFlags.length > 1 ? 'medium' : 'low';
  } else if (overall >= 55) {
    band = 'borderline';
    recommendation = 'Borderline - recruiter screening call first';
    risk = 'medium';
  }

  const strengths: string[] = [];
  if (skillMatchRatio > 0.7)
    strengths.push(`Strong skill match (${matched.length}/${allSkills.length} primary/mandatory skills evidenced)`);
  if (archHits >= 3) strengths.push('Clear architecture/design ownership evidence');
  if (leadHits >= 3) strengths.push('Demonstrated leadership and team management');
  if (modernHits >= 3) strengths.push('Cloud/DevOps/Modern stack fluency');
  if (deliveryHits >= 3) strengths.push('Strong production delivery footprint');
  if (certHits >= 1) strengths.push('Holds relevant certifications');

  const gaps: string[] = [];
  if (missing.length > 0) {
    gaps.push(
      `Missing skills: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`,
    );
  }
  if (totalYears < minExp) gaps.push(`Experience below benchmark (${totalYears} vs ${minExp}+ expected)`);
  if (archHits < 2 && (benchmark.seniority || '').toLowerCase().includes('arch'))
    gaps.push('Limited architecture artifact evidence for an architect role');
  if (leadHits < 2 && (benchmark.seniority || '').toLowerCase().includes('arch'))
    gaps.push('Limited leadership evidence for senior role');

  const interviewFocusAreas = [
    'Validate skill claims with project-specific deep dives',
    ...(redFlags.length > 0 ? ['Address red flags identified in screening'] : []),
    ...(missing.length > 0 ? [`Probe missing skills: ${missing.slice(0, 3).join(', ')}`] : []),
    ...((benchmark.seniority || '').toLowerCase().includes('arch') ? ['Ask for HLD/LLD walkthroughs'] : []),
  ];

  const interviewQuestions: string[] = benchmark.interviewQuestions || [];

  const finalSummary =
    `${candidateName || 'Candidate'} matches ${matched.length}/${allSkills.length} primary/mandatory skills with an estimated ${totalYears} years total experience. ` +
    `Overall score: ${overall}/100 (${band}). ${recommendation}. ` +
    (redFlags.length > 0 ? `Red flags: ${redFlags.length}. ` : 'No major red flags. ') +
    `Generated by rule-based engine (local fallback).`;

  return {
    candidateName: candidateName || 'Unknown Candidate',
    targetRole: benchmark.roleTitle || 'Unknown role',
    totalExperience: totalYears,
    relevantExperience: relevantYears,
    overallScore: overall,
    scoreBand: band,
    recommendation,
    risk,
    breakdown,
    matchedSkills: matched,
    missingSkills: missing,
    partiallyEvidencedSkills: partial,
    matchedEvidence,
    missingOrWeakEvidence: missingEvidence,
    redFlagsDetected: redFlags,
    strengths,
    gaps,
    interviewFocusAreas,
    interviewQuestions,
    finalSummary,
  };
}
