'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('App route error:', error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertOctagon className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>
            The page failed to render. We've captured the error - try again or head back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV !== 'production' && (
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-bg-muted p-3 text-xs">
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ''}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard"><Home className="h-4 w-4" /> Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
