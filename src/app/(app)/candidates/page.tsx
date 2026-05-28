'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, FileText } from 'lucide-react';
import { EngineBadge } from '@/components/engine-badge';
import { scoreBand, formatRelativeTime } from '@/lib/utils';
import { fetcher } from '@/lib/api-client';

interface Candidate {
  id: string;
  candidateName?: string | null;
  fileName: string;
  uploadedAt: string;
  benchmark: { roleTitle: string };
  score?: { overallScore: number; aiEngine: string } | null;
  decision?: { decision: string } | null;
  extractionStatus: string;
  extractedChars: number;
}

interface Response {
  candidates: Candidate[];
}

export default function CandidatesListPage() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useSWR<Response>('/api/candidates', fetcher);

  const filtered = (data?.candidates || []).filter(
    (c) => !q || (c.candidateName || c.fileName).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Pipeline</p>
        <h1 className="text-display-sm font-semibold tracking-tight">All candidates</h1>
        <p className="text-sm text-fg-muted">Across all benchmarks. Click for detail.</p>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input className="pl-9" placeholder="Search candidates..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-fg-muted">
          {filtered.length} of {data?.candidates.length || 0}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg-muted text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3">Engine</th>
                <th className="px-4 py-3">Extraction</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-fg-muted">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-fg-muted">
                    No candidates.
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const sb = c.score ? scoreBand(c.score.overallScore) : null;
                return (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-bg-muted">
                    <td className="px-4 py-3">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <FileText className="h-4 w-4 text-fg-muted" />
                        <span>{c.candidateName || c.fileName}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.benchmark.roleTitle}</td>
                    <td className="tabular px-4 py-3 text-right text-lg font-bold">
                      {c.score ? c.score.overallScore : '-'}
                    </td>
                    <td className="px-4 py-3">{c.score && <EngineBadge engine={c.score.aiEngine} />}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          c.extractionStatus === 'success'
                            ? 'success'
                            : c.extractionStatus === 'partial'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {c.extractionStatus}
                      </Badge>
                      <div className="mt-0.5 text-[11px] text-fg-muted">{c.extractedChars} ch</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          c.decision?.decision === 'shortlist'
                            ? 'success'
                            : c.decision?.decision === 'reject'
                              ? 'danger'
                              : c.decision?.decision === 'hold'
                                ? 'warning'
                                : 'secondary'
                        }
                      >
                        {c.decision?.decision || 'pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{formatRelativeTime(c.uploadedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
