import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getAIEngineStatus, engineToLabel, engineBadgeColor } from '@/lib/ai/config';
import { probeGeminiModel } from '@/lib/ai/gemini';
import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Upload,
  Trophy,
  Users,
  FileBarChart,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Activity,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { formatRelativeTime, scoreBand } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireAuth();
  const ai = getAIEngineStatus();
  const geminiProbe: Awaited<ReturnType<typeof probeGeminiModel>> | null = ai.geminiConfigured
    ? await probeGeminiModel().catch(
        () => ({ ok: false, error: 'probe failed' }) as Awaited<ReturnType<typeof probeGeminiModel>>,
      )
    : null;

  const [benchmarks, candidates, scoredCount, pending, shortlisted, recent, recentAudits] = await Promise.all([
    prisma.benchmark.count(),
    prisma.candidate.count(),
    prisma.scoreResult.count(),
    prisma.candidate.count({ where: { score: null } }),
    prisma.decision.count({ where: { decision: 'shortlist' } }),
    prisma.candidate.findMany({
      include: { score: true, benchmark: { select: { roleTitle: true } } },
      orderBy: { uploadedAt: 'desc' },
      take: 6,
    }),
    prisma.auditLog.findMany({
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const kpis = [
    { label: 'Benchmarks', value: benchmarks, icon: Sparkles, href: '/benchmark', tone: 'brand' },
    { label: 'Candidates', value: candidates, icon: Users, href: '/candidates', tone: 'info' },
    { label: 'Scored', value: scoredCount, icon: Trophy, href: '/ranking', tone: 'success' },
    { label: 'Pending', value: pending, icon: Clock, href: '/upload', tone: 'warning' },
    { label: 'Shortlisted', value: shortlisted, icon: CheckCircle2, href: '/ranking', tone: 'success' },
    { label: 'Reports', value: '*', icon: FileBarChart, href: '/reports', tone: 'info' },
  ] as const;

  const geminiOk = !!geminiProbe?.ok;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Welcome back</p>
          <h1 className="text-display-sm font-semibold tracking-tight">Hello, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Here is what is happening across your recruitment pipeline today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/benchmark/ai-research">
              <Sparkles className="h-4 w-4" /> AI research
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" /> Upload resumes
            </Link>
          </Button>
        </div>
      </header>

      {/* AI engine status banner */}
      <Card aria-live="polite">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${geminiOk ? 'bg-emerald-500/10 text-emerald-500' : ai.geminiConfigured ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}
            >
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Scoring Engine</div>
              <div className="text-xs text-fg-muted">
                {geminiOk && geminiProbe?.model
                  ? `Live via Gemini (${geminiProbe.model})`
                  : ai.geminiConfigured
                    ? `Gemini configured but probe failed: ${geminiProbe?.error || 'unknown'}`
                    : `Running in local fallback - no AI provider configured`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ai.geminiConfigured ? (geminiOk ? 'success' : 'warning') : 'slate'}>
              Gemini {ai.geminiConfigured ? (geminiOk ? 'online' : 'failing') : 'off'}
            </Badge>
            <Badge variant={ai.azureOpenAIConfigured ? 'indigo' : 'slate'}>
              Azure OpenAI {ai.azureOpenAIConfigured ? 'on' : 'off'}
            </Badge>
            <Badge variant={ai.searchConfigured ? 'info' : 'slate'}>Tavily {ai.searchConfigured ? 'on' : 'off'}</Badge>
            <Badge variant={ai.ocrConfigured ? 'success' : 'slate'}>OCR {ai.ocrConfigured ? 'on' : 'off'}</Badge>
            <Badge variant="purple">{engineToLabel(ai.preferredEngine)}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{k.label}</span>
              <k.icon className="h-4 w-4 text-fg-muted transition-colors group-hover:text-fg" />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div className="tabular text-display-md font-bold text-fg">{k.value}</div>
              <ArrowUpRight className="h-4 w-4 -translate-x-1 translate-y-1 text-fg-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </section>

      {/* Recent + activity */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent candidates</CardTitle>
            <CardDescription>Latest resumes uploaded into the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && <EmptyState />}
            {recent.map((c) => {
              const sb = c.score ? scoreBand(c.score.overallScore) : null;
              return (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all hover:border-border-strong hover:bg-bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{c.candidateName || c.fileName}</div>
                    <div className="truncate text-xs text-fg-muted">
                      {c.benchmark.roleTitle} - {formatRelativeTime(c.uploadedAt)}
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {c.score ? (
                      <>
                        <span className="tabular text-lg font-bold text-fg">{c.score.overallScore}</span>
                        <Badge
                          variant={
                            sb?.color === 'emerald'
                              ? 'success'
                              : sb?.color === 'blue'
                                ? 'info'
                                : sb?.color === 'amber'
                                  ? 'warning'
                                  : 'danger'
                          }
                        >
                          {sb?.short}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="slate">pending</Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent audit events.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" aria-label="Recent audit events">
              {recentAudits.length === 0 && <EmptyState compact />}
              {recentAudits.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <Activity className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-fg-muted" />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-fg">{a.action}</div>
                    <div className="text-xs text-fg-muted">
                      {a.user?.name || 'system'} - {formatRelativeTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="flex items-center justify-center gap-2 text-xs text-fg-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        AI scoring is advisory. Recruiters and hiring managers make the final decision. All actions are audited.
      </p>
    </div>
  );
}

function EmptyState({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-${compact ? 4 : 8} text-center`}
    >
      <AlertCircle className="h-5 w-5 text-fg-muted" />
      <div className="text-sm text-fg-muted">Nothing here yet.</div>
    </div>
  );
}
