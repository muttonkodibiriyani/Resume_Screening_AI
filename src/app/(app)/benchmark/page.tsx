import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Library, Plus, Users } from 'lucide-react';
import { EngineBadge } from '@/components/engine-badge';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BenchmarkListPage() {
  await requirePermission('benchmark:read');
  const benchmarks = await prisma.benchmark.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { candidates: true } } },
  });

  const approved = benchmarks.filter((b) => b.approvalStatus === 'approved').length;
  const draft = benchmarks.filter((b) => b.approvalStatus === 'draft').length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Benchmarks</p>
          <h1 className="text-display-sm font-semibold tracking-tight">Benchmark Library</h1>
          <p className="text-sm text-fg-muted">
            {benchmarks.length} total - {approved} approved - {draft} draft
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/benchmark/ai-research">
            <Plus className="h-4 w-4" /> New benchmark
          </Link>
        </Button>
      </header>

      {benchmarks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Library className="h-10 w-10 text-fg-muted" />
            <div className="text-base font-medium">No benchmarks yet</div>
            <p className="max-w-md text-sm text-fg-muted">
              Generate your first AI-researched benchmark to start scoring resumes.
            </p>
            <Button asChild className="mt-2 gap-2">
              <Link href="/benchmark/ai-research">
                <Plus className="h-4 w-4" /> Create benchmark
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map((b) => (
            <Link key={b.id} href={`/benchmark/${b.id}`} className="group block">
              <Card className="h-full transition-all group-hover:border-border-strong group-hover:shadow-md">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Library className="h-4 w-4" />
                    </div>
                    <Badge
                      variant={
                        b.approvalStatus === 'approved'
                          ? 'success'
                          : b.approvalStatus === 'draft'
                            ? 'secondary'
                            : 'warning'
                      }
                    >
                      {b.approvalStatus}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug">{b.roleTitle}</h3>
                    <div className="mt-1 text-xs text-fg-muted">
                      {b.skillFamily} - {b.seniority} - {b.minExperience}+ yrs
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <EngineBadge engine={b.generationMode} />
                    <span className="flex items-center gap-1 text-fg-muted">
                      <Users className="h-3 w-3" /> {b._count.candidates}
                    </span>
                  </div>
                  <div className="text-[10px] text-fg-muted">
                    v{b.version} - updated {formatRelativeTime(b.updatedAt)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
