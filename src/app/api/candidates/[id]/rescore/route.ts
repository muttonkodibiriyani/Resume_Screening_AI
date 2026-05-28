import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scoreCandidate, SCORING_PROMPT_VERSION } from '@/lib/scoring/ai-engine';
import { jsonParse } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';

export const POST = apiHandler(async (_req, { params }) => {
  const user = await requirePermission('candidate:rescore');

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { benchmark: true, score: true },
  });
  if (!candidate) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  if (!candidate.extractedText || candidate.extractedText.length < 50) {
    return NextResponse.json({ error: 'No extracted text available to rescore', code: 'NO_TEXT' }, { status: 400 });
  }

  const benchmark = candidate.benchmark;
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

  const scoring = await scoreCandidate({
    benchmark: benchmarkObj,
    resumeText: candidate.extractedText,
    candidateName: candidate.candidateName,
  });

  const saved = await prisma.scoreResult.upsert({
    where: { candidateId: candidate.id },
    update: {
      totalExperience: scoring.result.totalExperience,
      relevantExperience: scoring.result.relevantExperience,
      overallScore: scoring.result.overallScore,
      scoreBand: scoring.result.scoreBand,
      recommendation: scoring.result.recommendation,
      risk: scoring.result.risk,
      aiEngine: scoring.engine,
      modelUsed: scoring.modelUsed ?? null,
      promptVersion: SCORING_PROMPT_VERSION,
      weightsSnapshot: benchmark.weights,
      benchmarkVersionAtScore: benchmark.version,
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
      scoredAt: new Date(),
    },
    create: {
      candidateId: candidate.id,
      totalExperience: scoring.result.totalExperience,
      relevantExperience: scoring.result.relevantExperience,
      overallScore: scoring.result.overallScore,
      scoreBand: scoring.result.scoreBand,
      recommendation: scoring.result.recommendation,
      risk: scoring.result.risk,
      aiEngine: scoring.engine,
      modelUsed: scoring.modelUsed ?? null,
      promptVersion: SCORING_PROMPT_VERSION,
      weightsSnapshot: benchmark.weights,
      benchmarkVersionAtScore: benchmark.version,
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
    },
  });

  await logAudit({
    userId: user.id,
    action: 'CANDIDATE_RESCORED',
    entityType: 'Candidate',
    entityId: candidate.id,
    details: { engine: scoring.engine, model: scoring.modelUsed, score: scoring.result.overallScore },
    ipAddress: callerIp(),
  });

  return NextResponse.json({ score: saved, engine: scoring.engine, modelUsed: scoring.modelUsed });
});
