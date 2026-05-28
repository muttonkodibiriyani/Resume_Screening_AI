'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Trophy,
  ArrowRight,
  ScanSearch,
  Cpu,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBytes, scoreBand } from '@/lib/utils';
import { fetcher } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';

interface BenchmarkSummary {
  id: string;
  roleTitle: string;
  skillFamily: string;
  seniority: string;
  approvalStatus: string;
}

interface BenchmarksResponse {
  benchmarks: BenchmarkSummary[];
}

interface ProgressEvent {
  type: 'queued' | 'extracting' | 'extracted' | 'scoring' | 'done' | 'error';
  index: number;
  fileName: string;
  candidateId?: string;
  candidateName?: string;
  engine?: string;
  modelUsed?: string;
  score?: number;
  band?: string;
  extraction?: { status: string; charCount: number };
  error?: string;
}

type FileStatus = 'pending' | 'queued' | 'extracting' | 'extracted' | 'scoring' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
  message?: string;
  score?: number;
  band?: string;
  candidateId?: string;
  candidateName?: string;
  engine?: string;
  modelUsed?: string;
  extractionChars?: number;
}

export default function UploadPage() {
  const router = useRouter();
  const { data, error: benchErr } = useSWR<BenchmarksResponse>('/api/benchmarks', fetcher);
  const [benchmarkId, setBenchmarkId] = useState<string>('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!benchmarkId && data?.benchmarks?.[0]) setBenchmarkId(data.benchmarks[0].id);
  }, [data, benchmarkId]);

  const acceptedFiles = useCallback((newFiles: File[]): void => {
    setFiles((prev) => [
      ...prev,
      ...newFiles
        .filter((f) => /\.(pdf|docx|txt)$/i.test(f.name))
        .map((file) => ({ file, status: 'pending' as FileStatus })),
    ]);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    acceptedFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const start = async () => {
    if (!benchmarkId) {
      toast({ title: 'Pick a benchmark first', variant: 'warning' });
      return;
    }
    if (files.length === 0) {
      toast({ title: 'No files selected', variant: 'warning' });
      return;
    }

    setBusy(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'queued' })));

    const form = new FormData();
    form.append('benchmarkId', benchmarkId);
    files.forEach((f) => form.append('files', f.file));

    const csrf = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/)?.[1];

    try {
      const res = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: form,
        headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : undefined,
      });

      if (!res.ok || !res.body) {
        const body = await res.text();
        throw new Error(body || res.statusText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed) as ProgressEvent;
            applyEvent(ev);
          } catch (err) {
            console.error('parse err', err, trimmed);
          }
        }
      }
      toast({ title: 'Upload complete', variant: 'success' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: 'Upload failed', description: message.slice(0, 240), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const applyEvent = (ev: ProgressEvent) => {
    setFiles((prev) =>
      prev.map((entry, i) => {
        if (i !== ev.index) return entry;
        const next: FileEntry = { ...entry };
        if (ev.type === 'error') {
          next.status = 'error';
          next.message = ev.error || 'Unknown error';
        } else if (ev.type === 'done') {
          next.status = 'done';
          if (ev.score !== undefined) next.score = ev.score;
          if (ev.band) next.band = ev.band;
          if (ev.candidateId) next.candidateId = ev.candidateId;
          if (ev.candidateName) next.candidateName = ev.candidateName;
          if (ev.engine) next.engine = ev.engine;
          if (ev.modelUsed) next.modelUsed = ev.modelUsed;
          if (ev.extraction) next.extractionChars = ev.extraction.charCount;
        } else {
          next.status = ev.type;
          if (ev.extraction) next.extractionChars = ev.extraction.charCount;
          if (ev.candidateId) next.candidateId = ev.candidateId;
        }
        return next;
      }),
    );
  };

  const summary = useMemo(() => {
    const done = files.filter((f) => f.status === 'done').length;
    const errored = files.filter((f) => f.status === 'error').length;
    return { done, errored, total: files.length };
  }, [files]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Step 1 - Score</p>
        <h1 className="text-display-sm font-semibold tracking-tight">Upload candidate resumes</h1>
        <p className="text-sm text-fg-muted">
          Drag and drop PDFs, DOCX, or TXT. Each file is extracted, scored against the selected benchmark, and audited
          in real time.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Benchmark</CardTitle>
          <CardDescription>Pick the role definition every candidate will be scored against.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {benchErr && <Badge variant="danger">Failed to load benchmarks</Badge>}
          <select
            aria-label="Choose benchmark"
            value={benchmarkId}
            onChange={(e) => setBenchmarkId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border-strong bg-bg-elevated px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a benchmark...</option>
            {data?.benchmarks?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.roleTitle} - {b.seniority} ({b.approvalStatus})
              </option>
            ))}
          </select>
          {(!data?.benchmarks || data.benchmarks.length === 0) && (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-4 text-sm">
              <span className="text-fg-muted">No benchmarks yet.</span>
              <Button asChild variant="outline" size="sm">
                <a href="/benchmark/ai-research">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate one
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>Up to 50 files per upload. Max 10 MB each. PDF, DOCX, TXT.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-all ${
              dragging ? 'border-brand bg-brand-soft' : 'border-border bg-bg-muted hover:border-border-strong'
            }`}
          >
            <UploadCloud className="h-10 w-10 text-fg-muted" />
            <div>
              <div className="text-sm font-semibold text-fg">Drag files here or click to browse</div>
              <div className="text-xs text-fg-muted">We will scan, extract and score automatically.</div>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => e.target.files && acceptedFiles(Array.from(e.target.files))}
            />
          </button>

          {files.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>{files.length} file(s) selected</span>
                <span>
                  {summary.done} done - {summary.errored} failed
                </span>
              </div>
              <AnimatePresence initial={false}>
                {files.map((entry, i) => (
                  <motion.div
                    key={entry.file.name + i}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated p-3"
                  >
                    <FileText className="h-5 w-5 flex-shrink-0 text-fg-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">
                        {entry.candidateName || entry.file.name}
                      </div>
                      <div className="truncate text-[11px] text-fg-muted">
                        {formatBytes(entry.file.size)}
                        {entry.extractionChars !== undefined && ` - ${entry.extractionChars} chars`}
                        {entry.engine && ` - ${entry.engine}`}
                      </div>
                    </div>
                    <StatusChip entry={entry} />
                    {!busy && entry.status === 'pending' && (
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={() => removeFile(i)}
                        className="rounded p-1 text-fg-muted hover:bg-bg-muted hover:text-fg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setFiles([])} disabled={busy || files.length === 0}>
              Clear
            </Button>
            <div className="flex items-center gap-2">
              {summary.done > 0 && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={`/ranking?benchmarkId=${benchmarkId}`}>
                    <Trophy className="h-3.5 w-3.5" /> See ranking <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              <Button onClick={start} disabled={busy || files.length === 0 || !benchmarkId} loading={busy}>
                <Cpu className="h-4 w-4" /> Score now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusChip({ entry }: { entry: FileEntry }) {
  switch (entry.status) {
    case 'pending':
      return <Badge variant="secondary">queued</Badge>;
    case 'queued':
      return (
        <Badge variant="info" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> queued
        </Badge>
      );
    case 'extracting':
      return (
        <Badge variant="info" className="gap-1">
          <ScanSearch className="h-3 w-3 animate-pulse" /> extracting
        </Badge>
      );
    case 'extracted':
      return (
        <Badge variant="info" className="gap-1">
          <FileText className="h-3 w-3" /> extracted
        </Badge>
      );
    case 'scoring':
      return (
        <Badge variant="purple" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> scoring
        </Badge>
      );
    case 'done': {
      const sb = entry.score !== undefined ? scoreBand(entry.score) : null;
      return (
        <div className="flex items-center gap-2">
          <span className="tabular text-base font-bold text-fg">{entry.score ?? '-'}</span>
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
              className="gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> {sb.short}
            </Badge>
          )}
        </div>
      );
    }
    case 'error':
      return (
        <Badge variant="danger" className="gap-1" title={entry.message}>
          <AlertCircle className="h-3 w-3" /> failed
        </Badge>
      );
    default:
      return null;
  }
}
