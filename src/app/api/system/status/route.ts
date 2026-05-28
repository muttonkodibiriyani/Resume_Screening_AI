import { NextResponse } from 'next/server';
import { getAIEngineStatus } from '@/lib/ai/config';
import { probeGeminiModel } from '@/lib/ai/gemini';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const ai = getAIEngineStatus();

  let geminiProbe: { ok: boolean; model?: string; error?: string } | undefined;
  if (ai.geminiConfigured) {
    geminiProbe = await probeGeminiModel();
  }

  const session = await getSession();

  const [benchmarks, candidates, scored, pending, decisions] = await Promise.all([
    prisma.benchmark.count(),
    prisma.candidate.count(),
    prisma.scoreResult.count(),
    prisma.candidate.count({ where: { score: null } }),
    prisma.decision.count({ where: { decision: 'shortlist' } }),
  ]);

  const recentActivity = session
    ? await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { name: true, role: true } } },
      })
    : [];

  return NextResponse.json({
    ai: { ...ai, geminiProbe },
    stats: { benchmarks, candidates, scored, pending, shortlisted: decisions },
    recentActivity,
    authenticated: !!session,
  });
}
