import { prisma } from '@/lib/db';
import { requirePermission, can } from '@/lib/rbac';
import { getSession } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Globe } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requirePermission('audit:read');
  const user = await getSession();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  const todayCount = logs.filter((l) => Date.now() - l.createdAt.getTime() < 86400000).length;
  const loginCount = logs.filter((l) => l.action.includes('LOGIN')).length;
  const failureCount = logs.filter((l) => l.action.includes('FAILED') || l.action.includes('REJECTED')).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Governance</p>
        <h1 className="text-display-sm font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-fg-muted">Tamper-evident trail of every user action and AI scoring event.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total events" value={logs.length} />
        <Stat label="Last 24h" value={todayCount} />
        <Stat label="Login events" value={loginCount} />
        <Stat label="Failures" value={failureCount} tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-brand" /> Recent 500 events
          </CardTitle>
          <CardDescription>
            {can(user, 'audit:export') ? 'Export available - coming soon.' : 'Read-only.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-bg-muted text-left text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const failure = l.action.includes('FAILED') || l.action.includes('REJECTED');
                  return (
                    <tr key={l.id} className="border-b border-border/40 align-top hover:bg-bg-muted/60">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-muted">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={failure ? 'danger' : 'secondary'}>{l.action}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{l.user?.name || 'system'}</div>
                        <div className="text-[11px] text-fg-muted">{l.user?.role || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.entityType ? `${l.entityType}/${l.entityId?.slice(0, 8)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.ipAddress ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3 text-fg-muted" /> {l.ipAddress}
                          </span>
                        ) : (
                          <span className="text-fg-muted">-</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[11px] text-fg-muted">
                        {l.details ? (
                          <code className="line-clamp-3 whitespace-pre-wrap break-words">{l.details}</code>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warning' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{label}</div>
      <div className={`tabular mt-1 text-display-md font-bold ${tone === 'warning' ? 'text-amber-500' : 'text-fg'}`}>
        {value}
      </div>
    </div>
  );
}
