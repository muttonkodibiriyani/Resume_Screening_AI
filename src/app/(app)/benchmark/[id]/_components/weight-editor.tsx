'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';

const DIM_LABELS: Record<string, string> = {
  years: 'Years of experience',
  primarySkillDepth: 'Primary skill depth',
  architectureArtifacts: 'Architecture artifacts',
  projectFootprint: 'Project footprint',
  leadership: 'Leadership',
  modernization: 'Modernization / cloud',
  certifications: 'Certifications',
  communication: 'Communication',
};

const DEFAULTS: Record<string, number> = {
  years: 10,
  primarySkillDepth: 25,
  architectureArtifacts: 20,
  projectFootprint: 15,
  leadership: 10,
  modernization: 10,
  certifications: 5,
  communication: 5,
};

const MAX: Record<string, number> = {
  years: 40,
  primarySkillDepth: 50,
  architectureArtifacts: 40,
  projectFootprint: 40,
  leadership: 40,
  modernization: 40,
  certifications: 20,
  communication: 20,
};

interface Props {
  benchmarkId: string;
  initial: Record<string, number>;
  canEdit: boolean;
}

export function WeightEditor({ benchmarkId, initial, canEdit }: Props) {
  const seed: Record<string, number> = { ...DEFAULTS };
  for (const [k, v] of Object.entries(initial)) {
    if (k in DEFAULTS && typeof v === 'number') seed[k] = v;
  }
  const [w, setW] = useState<Record<string, number>>(seed);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const total = useMemo(() => Object.values(w).reduce((a, b) => a + b, 0), [w]);
  const sumOk = total === 100;

  const save = async () => {
    if (!sumOk) {
      toast({ title: 'Weights must sum to 100', description: `Current sum: ${total}`, variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/benchmarks/${benchmarkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ weights: w }),
      });
      toast({ title: 'Weights updated', variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(DEFAULTS).map(([k]) => (
        <div key={k} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor={`w-${k}`} className="font-medium">
              {DIM_LABELS[k] || k}
            </label>
            <span className="tabular font-bold text-fg">{w[k] || 0}</span>
          </div>
          <input
            id={`w-${k}`}
            type="range"
            min={0}
            max={MAX[k] || 40}
            value={w[k] || 0}
            disabled={!canEdit}
            onChange={(e) => setW((prev) => ({ ...prev, [k]: parseInt(e.target.value, 10) }))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-muted accent-brand disabled:opacity-50"
          />
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        <span>Total weight</span>
        <span className={`tabular text-lg font-bold ${sumOk ? 'text-emerald-500' : 'text-amber-500'}`}>
          {total} / 100
        </span>
      </div>
      {canEdit && (
        <Button onClick={save} loading={saving} disabled={!sumOk} className="w-full">
          Save weights
        </Button>
      )}
    </div>
  );
}
