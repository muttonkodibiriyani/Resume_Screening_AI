'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type Decision = 'shortlist' | 'hold' | 'reject';

const OPTIONS: { id: Decision; label: string; icon: typeof CheckCircle2; tone: string }[] = [
  {
    id: 'shortlist',
    label: 'Shortlist',
    icon: CheckCircle2,
    tone: 'border-emerald-500/40 hover:bg-emerald-500/10 data-[selected=true]:bg-emerald-500/15 data-[selected=true]:border-emerald-500',
  },
  {
    id: 'hold',
    label: 'Hold',
    icon: PauseCircle,
    tone: 'border-amber-500/40 hover:bg-amber-500/10 data-[selected=true]:bg-amber-500/15 data-[selected=true]:border-amber-500',
  },
  {
    id: 'reject',
    label: 'Reject',
    icon: XCircle,
    tone: 'border-red-500/40 hover:bg-red-500/10 data-[selected=true]:bg-red-500/15 data-[selected=true]:border-red-500',
  },
];

export function DecisionForm({
  candidateId,
  initial,
  initialComments,
}: {
  candidateId: string;
  initial?: string;
  initialComments?: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>((initial as Decision) || null);
  const [comments, setComments] = useState(initialComments || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!decision) return;
    if (decision !== 'shortlist' && comments.trim().length < 5) {
      toast({
        title: 'Add a short reason',
        description: '"Hold" and "reject" require at least 5 characters of justification.',
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/candidates/${candidateId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comments: comments || undefined }),
      });
      toast({ title: `Decision saved: ${decision}`, variant: 'success' });
      router.refresh();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : String(e);
      toast({ title: 'Failed to save decision', description: message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              data-selected={decision === o.id}
              onClick={() => setDecision(o.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all',
                o.tone,
              )}
            >
              <Icon className="h-4 w-4" />
              {o.label}
            </button>
          );
        })}
      </div>
      <Textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder={
          decision && decision !== 'shortlist'
            ? 'Required: explain the decision (audit trail)...'
            : 'Optional notes for hiring panel...'
        }
        rows={4}
      />
      <Button onClick={save} disabled={!decision} loading={saving} className="w-full">
        Save decision
      </Button>
    </div>
  );
}
