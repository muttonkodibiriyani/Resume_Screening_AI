import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Sparkles, TrendingUp, Scale, AlertCircle } from 'lucide-react';
import { jsonParse } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  await requirePermission('audit:read');

  const [scores, candidates, decisions, benchmarks, aiCalls] = await Promise.all([
    prisma.scoreResult.findMany({
      select: { overallScore: true, scoreBand: true, aiEngine: true, errorMessage: true, modelUsed: true },
    }),
    prisma.candidate.findMany({ select: { extractionStatus: true, ocrUsed: true, benchmarkId: true } }),
    prisma.decision.findMany({ select: { decision: true, candidateId: true } }),
    prisma.benchmark.findMany({
      select: { id: true, roleTitle: true, weights: true, _count: { select: { candidates: true } } },
    }),
    prisma.aICall.findMany({
      select: { provider: true, ok: true, modelUsed: true, costUsd: true, latencyMs: true },
      take: 500,
    }),
  ]);

  const bands: Record<string, number> = { ideal: 0, strong: 0, borderline: 0, reject: 0 };
  for (const s of scores) bands[s.scoreBand] = (bands[s.scoreBand] || 0) + 1;

  const engineCounts: Record<string, number> = {};
  for (const s of scores) engineCounts[s.aiEngine] = (engineCounts[s.aiEngine] || 0) + 1;

  const extractionCounts: Record<string, number> = {};
  for (const c of candidates) extractionCounts[c.extractionStatus] = (extractionCounts[c.extractionStatus] || 0) + 1;

  const decisionCounts: Record<string, number> = { shortlist: 0, hold: 0, reject: 0 };
  for (const d of decisions) decisionCounts[d.decision] = (decisionCounts[d.decision] || 0) + 1;

  const totalScored = scores.length || 1;
  const idealRate = ((bands.ideal || 0) / totalScored) * 100;
  const strongRate = ((bands.strong || 0) / totalScored) * 100;

  const totalCost = aiCalls.filter((c) => c.costUsd).reduce((acc, c) => acc + (c.costUsd || 0), 0);
  const avgLatency = aiCalls.length
    ? Math.round(aiCalls.filter((c) => c.latencyMs).reduce((acc, c) => acc + (c.latencyMs || 0), 0) / aiCalls.length)
    : 0;
  const aiFailures = aiCalls.filter((c) => !c.ok).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Governance</p>
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-tight">
          <BarChart3 className="h-7 w-7 text-brand" /> Insights & Bias
        </h1>
        <p className="text-sm text-fg-muted">
          Operational signals for fairness, AI engine health, and cost transparency.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Scored" value={String(scores.length)} icon={Sparkles} />
        <KpiCard label="% ideal" value={`${idealRate.toFixed(1)}%`} icon={TrendingUp} />
        <KpiCard label="% strong+" value={`${(idealRate + strongRate).toFixed(1)}%`} icon={Scale} />
        <KpiCard
          label="AI failures"
          value={String(aiFailures)}
          icon={AlertCircle}
          tone={aiFailures > 0 ? 'warning' : undefined}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
            <CardDescription>How candidates are landing across the rubric bands.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBars
              segments={[
                { label: 'Ideal (85+)', value: bands.ideal || 0, color: 'bg-emerald-500' },
                { label: 'Strong (70-84)', value: bands.strong || 0, color: 'bg-info' },
                { label: 'Borderline (55-69)', value: bands.borderline || 0, color: 'bg-amber-500' },
                { label: 'Reject (<55)', value: bands.reject || 0, color: 'bg-red-500' },
              ]}
              total={totalScored}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI engine mix</CardTitle>
            <CardDescription>Which engine actually produced each score (transparency check).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(engineCounts).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span className="font-medium">{k}</span>
                <Badge variant={k.includes('local') ? 'warning' : 'info'}>
                  {v} ({((v / totalScored) * 100).toFixed(0)}%)
                </Badge>
              </div>
            ))}
            {Object.keys(engineCounts).length === 0 && <p className="text-sm text-fg-muted">No scores yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision funnel</CardTitle>
            <CardDescription>Recruiter decisions vs total scored.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBars
              segments={[
                { label: 'Shortlist', value: decisionCounts.shortlist ?? 0, color: 'bg-emerald-500' },
                { label: 'Hold', value: decisionCounts.hold ?? 0, color: 'bg-amber-500' },
                { label: 'Reject', value: decisionCounts.reject ?? 0, color: 'bg-red-500' },
                {
                  label: 'Pending',
                  value: Math.max(totalScored - Object.values(decisionCounts).reduce((a, b) => a + b, 0), 0),
                  color: 'bg-slate-400',
                },
              ]}
              total={totalScored}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extraction health</CardTitle>
            <CardDescription>How well resumes are being parsed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(extractionCounts).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                <Badge
                  variant={k === 'success' ? 'success' : k === 'partial' || k === 'ocr_required' ? 'warning' : 'danger'}
                >
                  {v}
                </Badge>
              </div>
            ))}
            {Object.keys(extractionCounts).length === 0 && <p className="text-sm text-fg-muted">No uploads yet.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI cost ledger (last 500 calls)</CardTitle>
            <CardDescription>
              Cost per call is captured when the provider reports it. AI errors and average latency are monitored.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total spent" value={`$${totalCost.toFixed(2)}`} />
            <Stat label="Avg latency" value={`${avgLatency} ms`} />
            <Stat label="Failures" value={String(aiFailures)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Benchmark mix</CardTitle>
            <CardDescription>
              How weighting differs across roles; helps spot benchmarks that under-weight key dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-fg-muted">
                  <tr>
                    <th className="px-2 py-2">Role</th>
                    <th className="px-2 py-2 text-right">Candidates</th>
                    <th className="px-2 py-2 text-right">Years</th>
                    <th className="px-2 py-2 text-right">Skill</th>
                    <th className="px-2 py-2 text-right">Arch</th>
                    <th className="px-2 py-2 text-right">Leadership</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b) => {
                    const w = jsonParse<Record<string, number>>(b.weights, {});
                    return (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-2 py-2 font-medium">{b.roleTitle}</td>
                        <td className="px-2 py-2 text-right">{b._count.candidates}</td>
                        <td className="tabular px-2 py-2 text-right">{w.years ?? '-'}</td>
                        <td className="tabular px-2 py-2 text-right">{w.primarySkillDepth ?? '-'}</td>
                        <td className="tabular px-2 py-2 text-right">{w.architectureArtifacts ?? '-'}</td>
                        <td className="tabular px-2 py-2 text-right">{w.leadership ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-fg-muted">
        Bias mitigation: we deliberately do not analyse protected attributes (gender, age, race, nationality). If you
        want a deeper fairness audit, export the audit log and run it through your fairness toolkit of choice (e.g. IBM
        AIF360, Fairlearn).
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'warning';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{label}</span>
        <Icon className="h-4 w-4 text-fg-muted" />
      </div>
      <div className={`tabular mt-2 text-display-md font-bold ${tone === 'warning' ? 'text-amber-500' : 'text-fg'}`}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="tabular mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function DistributionBars({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-muted">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return <div key={s.label} className={s.color} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="truncate text-fg-muted">{s.label}</span>
            <span className="tabular ml-auto font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
