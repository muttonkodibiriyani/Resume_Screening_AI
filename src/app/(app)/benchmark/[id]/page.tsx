import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission, can } from '@/lib/rbac';
import { getSession } from '@/lib/auth';
import { jsonParse, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EngineBadge } from '@/components/engine-badge';
import { BenchmarkActions } from './_components/benchmark-actions';
import { WeightEditor } from './_components/weight-editor';
import { ChevronLeft, AlertTriangle, Globe, BookOpen, Upload, CheckCircle2, ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function BenchmarkDetailPage({ params }: PageProps) {
  await requirePermission('benchmark:read');
  const user = await getSession();
  const b = await prisma.benchmark.findUnique({
    where: { id: params.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!b) notFound();

  const primarySkills = jsonParse<string[]>(b.primarySkills, []);
  const mandatorySkills = jsonParse<string[]>(b.mandatorySkills, []);
  const goodToHave = jsonParse<string[]>(b.goodToHaveSkills, []);
  const techDepth = jsonParse<string[]>(b.technicalDepth, []);
  const archExp = jsonParse<string[]>(b.architectureExp, []);
  const leadExp = jsonParse<string[]>(b.leadershipExp, []);
  const delivExp = jsonParse<string[]>(b.deliveryExp, []);
  const modernExp = jsonParse<string[]>(b.modernizationExp, []);
  const redFlags = jsonParse<string[]>(b.redFlags, []);
  const interview = jsonParse<string[]>(b.interviewQuestions, []);
  const weights = jsonParse<Record<string, number>>(b.weights, {});
  const sources = jsonParse<{ title: string; url: string }[]>(b.sources, []);
  const screeningNotes = jsonParse<string[]>(b.screeningNotes, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/benchmark" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> Library
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-display-sm font-semibold tracking-tight">{b.roleTitle}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{b.skillFamily}</Badge>
            <Badge variant="secondary">{b.seniority}</Badge>
            <Badge variant="secondary">{b.minExperience}+ yrs</Badge>
            <Badge
              variant={
                b.approvalStatus === 'approved' ? 'success' : b.approvalStatus === 'draft' ? 'warning' : 'secondary'
              }
            >
              {b.approvalStatus}
            </Badge>
            <Badge variant="info">v{b.version}</Badge>
            <EngineBadge engine={b.generationMode} />
            <Badge variant="slate">{b._count.candidates} candidates</Badge>
          </div>
          {b.idealSummary && <p className="max-w-3xl text-sm text-fg-muted">{b.idealSummary}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Button asChild className="gap-2">
            <Link href={`/upload?benchmarkId=${b.id}`}>
              <Upload className="h-4 w-4" /> Upload resumes
            </Link>
          </Button>
          <BenchmarkActions
            id={b.id}
            approvalStatus={b.approvalStatus}
            canApprove={can(user, 'benchmark:approve')}
            canBumpVersion={can(user, 'benchmark:bump_version')}
            canDelete={can(user, 'benchmark:delete')}
          />
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="expectations">Expectations</TabsTrigger>
          <TabsTrigger value="redflags">Red flags</TabsTrigger>
          <TabsTrigger value="interview">Interview pack</TabsTrigger>
          <TabsTrigger value="weights">Weights</TabsTrigger>
          {sources.length > 0 && <TabsTrigger value="sources">Sources</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-brand" /> Snapshot
              </CardTitle>
              <CardDescription>The condensed view of this benchmark.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <SnapshotBlock title="Primary skills" items={primarySkills} variant="default" />
              <SnapshotBlock title="Mandatory" items={mandatorySkills} variant="info" />
              <SnapshotBlock title="Good to have" items={goodToHave} variant="secondary" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Provenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Source" value={b.benchmarkSource} />
              <Row label="Engine" value={b.generationMode} />
              <Row label="Created" value={formatDate(b.createdAt)} />
              <Row label="Updated" value={formatDate(b.updatedAt)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardContent className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
              <SnapshotBlock title="Primary skills" items={primarySkills} variant="default" />
              <SnapshotBlock title="Mandatory" items={mandatorySkills} variant="info" />
              <SnapshotBlock title="Good to have" items={goodToHave} variant="secondary" />
              <List title="Technical depth indicators" items={techDepth} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expectations">
          <Card>
            <CardContent className="grid gap-6 p-6 md:grid-cols-2">
              <List title="Architecture" items={archExp} />
              <List title="Leadership" items={leadExp} />
              <List title="Delivery" items={delivExp} />
              <List title="Modernization" items={modernExp} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redflags">
          <Card>
            <CardContent className="p-6">
              {redFlags.length === 0 ? (
                <p className="text-sm text-fg-muted">No red flags defined.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {redFlags.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-md border border-border p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
              {screeningNotes.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-muted">
                    Screening notes
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {screeningNotes.map((n, i) => (
                      <li key={i}>- {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand" /> Question bank
              </CardTitle>
              <CardDescription>Sharp, role-specific questions for the panel.</CardDescription>
            </CardHeader>
            <CardContent>
              {interview.length === 0 ? (
                <p className="text-sm text-fg-muted">No questions defined.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {interview.map((q, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <span className="tabular mr-2 font-bold text-fg-muted">{String(i + 1).padStart(2, '0')}.</span>
                      {q}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights">
          <Card>
            <CardHeader>
              <CardTitle>Scoring weights</CardTitle>
              <CardDescription>
                Drag to rebalance how each rubric dimension contributes to the overall score. Must sum to 100.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeightEditor benchmarkId={b.id} initial={weights} canEdit={can(user, 'benchmark:update')} />
            </CardContent>
          </Card>
        </TabsContent>

        {sources.length > 0 && (
          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-brand" /> Research sources
                </CardTitle>
                <CardDescription>Live web research used to build this benchmark.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {sources.map((s, i) => (
                    <li key={i}>
                      <a className="text-brand hover:underline" href={s.url} target="_blank" rel="noreferrer noopener">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SnapshotBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: 'default' | 'info' | 'secondary';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <Badge key={i} variant={variant}>
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
