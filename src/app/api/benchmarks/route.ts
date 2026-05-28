import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateBenchmark } from '@/lib/benchmarks/generator';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler, parseJson } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { benchmarkCreateSchema } from '@/lib/validation/schemas';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const GET = apiHandler(async () => {
  await requirePermission('benchmark:read');
  const benchmarks = await prisma.benchmark.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { candidates: true } } },
  });
  return NextResponse.json({ benchmarks });
});

export const POST = apiHandler(async (req) => {
  const user = await requirePermission('benchmark:create');

  const rl = rateLimit(user.id, LIMITS.benchmarkCreate);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Benchmark generation rate limit exceeded', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  const input = await parseJson(req, benchmarkCreateSchema);
  const generated = await generateBenchmark(input);
  const b = generated.benchmark;

  const created = await prisma.benchmark.create({
    data: {
      roleTitle: b.roleTitle,
      skillFamily: b.skillFamily,
      seniority: b.seniority,
      minExperience: b.minExperience,
      domainContext: b.domainContext,
      primarySkills: JSON.stringify(b.primarySkills),
      mandatorySkills: JSON.stringify(b.mandatorySkills),
      goodToHaveSkills: JSON.stringify(b.goodToHaveSkills),
      technicalDepth: JSON.stringify(b.technicalDepthIndicators),
      functionalDomain: JSON.stringify(b.functionalDomainIndicators),
      architectureExp: JSON.stringify(b.architectureExpectations),
      leadershipExp: JSON.stringify(b.leadershipExpectations),
      deliveryExp: JSON.stringify(b.deliveryExpectations),
      modernizationExp: JSON.stringify(b.modernizationExpectations),
      redFlags: JSON.stringify(b.redFlags),
      weights: JSON.stringify(b.weights),
      interviewQuestions: JSON.stringify(b.interviewQuestions),
      idealSummary: b.idealCandidateSummary || b.idealSummary || '',
      screeningNotes: JSON.stringify(b.screeningNotes || []),
      benchmarkSource: generated.benchmarkSource,
      generationMode: generated.engineUsed,
      sources: JSON.stringify(generated.sources || []),
      createdBy: user.id,
      approvalStatus: 'draft',
    },
  });

  await logAudit({
    userId: user.id,
    action: 'BENCHMARK_CREATED',
    entityType: 'Benchmark',
    entityId: created.id,
    details: { engine: generated.engineUsed, source: generated.benchmarkSource },
    ipAddress: callerIp(),
  });

  return NextResponse.json({
    benchmark: created,
    engineUsed: generated.engineUsed,
    source: generated.benchmarkSource,
    sources: generated.sources,
  });
});
