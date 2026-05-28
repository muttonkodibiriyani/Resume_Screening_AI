'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Cpu } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';

export function RescoreButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await apiFetch<{ engine: string; modelUsed?: string }>(`/api/candidates/${candidateId}/rescore`, {
            method: 'POST',
          });
          toast({
            title: 'Re-scored',
            description: `Engine: ${r.engine}${r.modelUsed ? ` (${r.modelUsed})` : ''}`,
            variant: 'success',
          });
          router.refresh();
        } catch (e) {
          const message = e instanceof ApiError ? e.message : String(e);
          toast({ title: 'Re-score failed', description: message, variant: 'error' });
        } finally {
          setBusy(false);
        }
      }}
      className="gap-2"
    >
      <Cpu className="h-4 w-4" /> Re-score
    </Button>
  );
}
