'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { ShieldCheck, Trash2, ArrowUpCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';

interface Props {
  id: string;
  approvalStatus: string;
  canApprove: boolean;
  canBumpVersion: boolean;
  canDelete: boolean;
}

export function BenchmarkActions({ id, approvalStatus, canApprove, canBumpVersion, canDelete }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const approve = async () => {
    try {
      await apiFetch(`/api/benchmarks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus: 'approved' }),
      });
      toast({ title: 'Benchmark approved', variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: 'Approve failed', description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    }
  };

  const bump = async () => {
    try {
      await apiFetch(`/api/benchmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ bumpVersion: true }) });
      toast({ title: 'Version bumped', description: 'Benchmark is now in draft.', variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: 'Bump failed', description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/benchmarks/${id}`, { method: 'DELETE' });
      toast({ title: 'Deleted', variant: 'success' });
      router.push('/benchmark');
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {canApprove && approvalStatus !== 'approved' && (
        <Button variant="outline" className="gap-2" onClick={approve}>
          <ShieldCheck className="h-4 w-4" /> Approve
        </Button>
      )}
      {canBumpVersion && (
        <Button variant="outline" className="gap-2" onClick={bump}>
          <ArrowUpCircle className="h-4 w-4" /> Bump version
        </Button>
      )}
      {canDelete && (
        <>
          <Button variant="outline" className="gap-2" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this benchmark?</DialogTitle>
                <DialogDescription>
                  Associated candidates, scores, and decisions will be permanently removed. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={remove}>
                  Delete permanently
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
