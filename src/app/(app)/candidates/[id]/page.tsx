import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { jsonParse, formatDate, formatBytes, scoreBand } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EngineBadge } from '@/components/engine-badge';
import { ScoreRadial } from '@/components/score-radial';
import { DecisionForm } from './_components/decision-form';
import { RescoreButton } from './_components/rescore-button';
import { Download, ChevronLeft, FileText, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function CandidatePage({ params }: PageProps) {
  await requirePermission('candidate:read');
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      score: true,
      decision: { include: { decidedByUser: { select: { name: true } } } },
      benchmark: true,
    },
  });
  if (!candidate) notFound();
  const score = candidate.score;
  const benchmark = candidate.benchmark;
  const decision = candidate.decision;

  const breakdown = jsonParse<Record<string, number>>(score?.breakdown, {});
  const weights = jsonParse<Record<string, number>>(benchmark.weights, {});
  const matched = jsonParse<string[]>(score?.matchedSkills, []);
  const missing = jsonParse<string[]>(score?.missingSkills, []);
  const partial = jsonParse<string[]>(score?.partiallyEvidenced, []);
  const matchedEv = jsonParse<string[]>(score?.matchedEvidence, []);
  const missingEv = jsonParse<string[]>(score?.missingEvidence, []);
  const flags = jsonParse<string[]>(score?.redFlagsDetected, []);
  const strengths = jsonParse<string[]>(score?.strengths, []);
  const gaps = jsonParse<string[]>(score?.gaps, []);
  const focus = jsonParse<string[]>(score?.interviewFocusAreas, []);
  const questions = jsonParse<string[]>(score?.interviewQuestions, []);

  const dimsLabels: Record<string, string> = {
    years: 'Years',
    primarySkillDepth: 'Skill depth',
    architectureArtifacts: 'Architecture',
    projectFootprint: 'Delivery',
    leadership: 'Leadership',
    modernization: 'Modern stack',
    certifications: 'Certifications',
    communication: 'Communication',
  };

  const dims = Object.keys(weights).map((k) => ({
    key: k,
    label: dimsLabels[k] || k,
    value: breakdown[k] || 0,
    weight: weights[k] || 0,
  }));

  const sb = score ? scoreBand(score.overallScore) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/ranking" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ChevronLeft className="h-4 w-4" /> Back to ranking
        </Link>
        <div className="flex gap-2">
          {candidate.filePath && (
            <Button asChild variant="outline" className="gap-2">
              <a href={`/api/candidates/${candidate.id}/resume`}><Download className="h-4 w-4" /> Original resume</a>
            </Button>
          )}
          <RescoreButton candidateId={candidate.id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT - candidate summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="alshaya-gradient flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white">
                {(candidate.candidateName || candidate.fileName).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{candidate.candidateName || 'Unknown candidate'}</CardTitle>
                <CardDescription className="truncate">{candidate.email || candidate.fileName}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <Row label="Phone" value={candidate.phone || '-'} />
              <Row label="Target role" value={benchmark.roleTitle} />
              <Row label="Benchmark" value={`${benchmark.skillFamily} v${benchmark.version}`} />
              <Row label="File" value={`${candidate.fileName} (${formatBytes(candidate.fileSize)})`} />
              <Row label="Extraction" value={`${candidate.extractionStatus} - ${candidate.extractedChars} chars`} />
              <Row label="Uploaded" value={formatDate(candidate.uploadedAt)} />
              {score?.modelUsed && <Row label="Model" value={score.modelUsed} />}
            </dl>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant={candidate.extractionStatus === 'success' ? 'success' : candidate.extractionStatus === 'partial' ? 'warning' : 'danger'}>
                {candidate.extractionStatus}
              </Badge>
              {score && <EngineBadge engine={score.aiEngine} />}
              {decision && (
                <Badge variant={decision.decision === 'shortlist' ? 'success' : decision.decision === 'reject' ? 'danger' : 'warning'}>
                  {decision.decision}
                </Badge>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Strengths</h4>
              <ul className="space-y-1.5 text-xs">
                {strengths.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-500" />
                    <span>{s}</span>
                  </li>
                ))}
                {strengths.length === 0 && <li className="text-fg-muted">None identified.</li>}
              </ul>
            </div>

            {flags.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Red flags</h4>
                <ul className="space-y-1.5 text-xs">
                  {flags.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CENTER - score visual */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Score</CardTitle>
            <CardDescription>
              Weighted breakdown across {dims.length} rubric dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {score ? <ScoreRadial dims={dims} overall={score.overallScore} /> : <NoScore />}
            {sb && (
              <div className="text-center">
                <Badge variant={sb.color === 'emerald' ? 'success' : sb.color === 'blue' ? 'info' : sb.color === 'amber' ? 'warning' : 'danger'}>
                  {sb.label}
                </Badge>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dims.map((d) => (
                <div key={d.key} className="flex items-center justify-between rounded-md border border-border p-2">
                  <span className="text-fg-muted">{d.label}</span>
                  <span className="font-semibold tabular">{d.value}/{d.weight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT - decision */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>Recruiter / hiring manager call. Audited.</CardDescription>
          </CardHeader>
          <CardContent>
            <DecisionForm candidateId={candidate.id} initial={decision?.decision} initialComments={decision?.comments || ''} />
            {decision && (
              <div className="mt-4 flex items-center gap-2 text-[11px] text-fg-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Last updated by {decision.decidedByUser?.name} on {formatDate(decision.decidedAt)}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs - details */}
      <Tabs defaultValue="skills">
        <TabsList className="flex-wrap">
          <TabsTrigger value="skills">Skills evidence</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
          <TabsTrigger value="interview">Interview pack</TabsTrigger>
          <TabsTrigger value="summary">AI summary</TabsTrigger>
          <TabsTrigger value="resume">Resume text</TabsTrigger>
          {score?.rawResponse && <TabsTrigger value="raw">Raw AI response</TabsTrigger>}
        </TabsList>

        <TabsContent value="skills">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <SkillsList title={`Matched (${matched.length})`} variant="success" items={matched} evidence={matchedEv} />
              <SkillsList title={`Partial (${partial.length})`} variant="warning" items={partial} />
              <SkillsList title={`Missing (${missing.length})`} variant="danger" items={missing} evidence={missingEv} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps">
          <Card>
            <CardContent className="space-y-2 p-6 text-sm">
              {gaps.length === 0 && <p className="text-fg-muted">No gaps identified.</p>}
              {gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <span>{g}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card>
            <CardContent className="space-y-6 p-6">
              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Focus areas</h4>
                <ul className="space-y-2 text-sm">
                  {focus.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {focus.length === 0 && <li className="text-fg-muted">None.</li>}
                </ul>
              </section>
              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Questions</h4>
                <ol className="space-y-2 text-sm">
                  {questions.map((q, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <span className="mr-2 font-bold tabular text-fg-muted">{String(i + 1).padStart(2, '0')}.</span>
                      {q}
                    </li>
                  ))}
                  {questions.length === 0 && <li className="text-fg-muted">No questions yet.</li>}
                </ol>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-6 text-sm leading-7">
              {score ? score.finalSummary : <p className="text-fg-muted">No AI summary yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume">
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-xs text-fg-muted">
                <FileText className="h-3.5 w-3.5" /> {candidate.extractedChars} characters
              </div>
              <pre className="scrollbar-thin max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg-muted p-4 text-xs">
                {candidate.extractedText || 'No text extracted'}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {score?.rawResponse && (
          <TabsContent value="raw">
            <Card>
              <CardContent className="p-6">
                <pre className="scrollbar-thin max-h-[600px] overflow-auto rounded-md border border-border bg-bg-muted p-4 text-[11px]">
                  {score.rawResponse}
                </pre>
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
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="text-right text-xs">{value}</dd>
    </div>
  );
}

function NoScore() {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-border bg-bg-muted p-12 text-center text-sm text-fg-muted">
      Not scored yet.
    </div>
  );
}

function SkillsList({ title, variant, items, evidence }: { title: string; variant: 'success' | 'warning' | 'danger'; items: string[]; evidence?: string[] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</h4>
      <ul className="space-y-2 text-xs">
        {items.length === 0 && <li className="text-fg-muted">None.</li>}
        {items.map((s, i) => {
          const ev = evidence?.[i];
          return (
            <li key={i} className="space-y-1">
              <Badge variant={variant}>{s}</Badge>
              {ev && <div className="pl-2 text-[11px] italic text-fg-muted">"{ev.slice(0, 200)}"</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
