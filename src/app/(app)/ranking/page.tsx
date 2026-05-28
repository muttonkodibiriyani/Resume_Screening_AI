import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { jsonParse, scoreBand, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EngineBadge } from '@/components/engine-badge';
import { Trophy, FileBarChart, Upload, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { benchmarkId?: string };
}

export default async function RankingPage({ searchParams }: PageProps) {
  await requirePermission('candidate:read');

  const benchmarks = await prisma.benchmark.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { candidates: true } } },
  });
  const selectedId = searchParams.benchmarkId || benchmarks[0]?.id || '';
  const selected = benchmarks.find((b) => b.id === selectedId) || benchmarks[0];

  const candidates = selected
    ? await prisma.candidate.findMany({
        where: { benchmarkId: selected.id, score: { isNot: null } },
        include: { score: true, decision: true },
        orderBy: { uploadedAt: 'desc' },
      })
    : [];

  const ranked = [...candidates].sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0));
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Pipeline</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-display-sm font-semibold tracking-tight">Ranking</h1>
            <p className="text-sm text-fg-muted">
              {selected
                ? `Candidates scored against "${selected.roleTitle}" v${selected.version}.`
                : 'No benchmarks yet.'}
            </p>
          </div>
          {selected && (
            <div className="flex gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/upload?benchmarkId=${selected.id}`}>
                  <Upload className="h-4 w-4" /> Add resumes
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href={`/reports?benchmarkId=${selected.id}`}>
                  <FileBarChart className="h-4 w-4" /> Export report
                </Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 overflow-x-auto">
            {benchmarks.map((b) => (
              <Link
                key={b.id}
                href={`/ranking?benchmarkId=${b.id}`}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  b.id === selected?.id
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-border bg-bg hover:border-border-strong'
                }`}
              >
                {b.roleTitle} <span className="opacity-70">({b._count.candidates})</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {ranked.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Trophy className="h-10 w-10 text-fg-muted" />
            <div className="text-base font-medium">No candidates scored yet</div>
            <p className="max-w-md text-sm text-fg-muted">
              Upload resumes against this benchmark and they will appear here, ranked by overall score.
            </p>
            {selected && (
              <Button asChild className="gap-2">
                <Link href={`/upload?benchmarkId=${selected.id}`}>
                  <Upload className="h-4 w-4" /> Upload resumes
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <section aria-label="Top 3" className="grid gap-4 md:grid-cols-3">
              {top3.map((c, i) => {
                const sb = scoreBand(c.score?.overallScore || 0);
                const places = ['1st', '2nd', '3rd'];
                const place = places[i] ?? `${i + 1}th`;
                const matched = jsonParse<string[]>(c.score?.matchedSkills, []);
                return (
                  <Link
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-lg"
                  >
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      {place}
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${i === 0 ? 'bg-gold-500/20 text-gold-600' : 'bg-bg-muted text-fg-muted'}`}
                      >
                        {i === 0 ? <Trophy className="h-5 w-5" /> : i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-fg">{c.candidateName || c.fileName}</div>
                        <div className="truncate text-[11px] text-fg-muted">{c.email || c.fileName}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="tabular text-display-md font-bold text-fg">{c.score?.overallScore || 0}</div>
                        <Badge
                          variant={
                            sb.color === 'emerald'
                              ? 'success'
                              : sb.color === 'blue'
                                ? 'info'
                                : sb.color === 'amber'
                                  ? 'warning'
                                  : 'danger'
                          }
                        >
                          {sb.short}
                        </Badge>
                      </div>
                      {c.score && <EngineBadge engine={c.score.aiEngine} />}
                    </div>
                    <div className="text-[11px] text-fg-muted">
                      {matched.length} skill(s) matched - uploaded {formatRelativeTime(c.uploadedAt)}
                    </div>
                    <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
            </section>
          )}

          {/* Full table */}
          <Card>
            <CardHeader>
              <CardTitle>Full ranking</CardTitle>
              <CardDescription>Click a row to open the candidate detail.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-bg-muted text-left text-xs uppercase tracking-wide text-fg-muted">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3">Band</th>
                      <th className="px-4 py-3">Recommendation</th>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3">Engine</th>
                      <th className="px-4 py-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((c, i) => {
                      const sb = c.score ? scoreBand(c.score.overallScore) : null;
                      const decision = c.decision?.decision;
                      return (
                        <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-bg-muted">
                          <td className="px-4 py-3 text-xs font-semibold text-fg-muted">{i + 4}</td>
                          <td className="px-4 py-3">
                            <Link href={`/candidates/${c.id}`} className="font-medium text-fg hover:underline">
                              {c.candidateName || c.fileName}
                            </Link>
                            <div className="text-[11px] text-fg-muted">{c.email || ''}</div>
                          </td>
                          <td className="tabular px-4 py-3 text-right text-lg font-bold">
                            {c.score?.overallScore ?? '-'}
                          </td>
                          <td className="px-4 py-3">
                            {sb && (
                              <Badge
                                variant={
                                  sb.color === 'emerald'
                                    ? 'success'
                                    : sb.color === 'blue'
                                      ? 'info'
                                      : sb.color === 'amber'
                                        ? 'warning'
                                        : 'danger'
                                }
                              >
                                {sb.short}
                              </Badge>
                            )}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-xs">{c.score?.recommendation || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                c.score?.risk === 'low' ? 'success' : c.score?.risk === 'medium' ? 'warning' : 'danger'
                              }
                            >
                              {c.score?.risk || '-'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {c.score?.aiEngine && <EngineBadge engine={c.score.aiEngine} />}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                decision === 'shortlist'
                                  ? 'success'
                                  : decision === 'reject'
                                    ? 'danger'
                                    : decision === 'hold'
                                      ? 'warning'
                                      : 'secondary'
                              }
                            >
                              {decision || 'pending'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
