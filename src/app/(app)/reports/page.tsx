import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requirePermission('report:download');
  const benchmarks = await prisma.benchmark.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { candidates: true } } },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Reports</p>
        <h1 className="text-display-sm flex items-center gap-2 font-semibold tracking-tight">
          <FileBarChart className="h-7 w-7 text-brand" /> Exports
        </h1>
        <p className="text-sm text-fg-muted">CSV, Excel, and PDF reports per benchmark. Ranking + top-3 + evidence + audit timestamp.</p>
      </header>

      {benchmarks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-fg-muted">No benchmarks yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {benchmarks.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{b.roleTitle}</div>
                    <div className="truncate text-xs text-fg-muted">
                      {b.skillFamily} - v{b.version} - {b._count.candidates} candidates
                    </div>
                  </div>
                  <Badge variant={b.approvalStatus === 'approved' ? 'success' : 'secondary'}>{b.approvalStatus}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <a href={`/api/reports/${b.id}?format=csv`}><FileText className="h-3 w-3" /> CSV</a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <a href={`/api/reports/${b.id}?format=xlsx`}><FileSpreadsheet className="h-3 w-3" /> Excel</a>
                  </Button>
                  <Button asChild size="sm" className="gap-1">
                    <a href={`/api/reports/${b.id}?format=pdf`}><Download className="h-3 w-3" /> PDF</a>
                  </Button>
                </div>
                <p className="text-[11px] text-fg-muted">Updated {formatRelativeTime(b.updatedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
