'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from './toast-store';

export { toast } from './toast-store';

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  error: <AlertOctagon className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-brand" />,
};

const STRIPE: Record<'success' | 'warning' | 'error' | 'info', string> = {
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  error: 'border-l-red-500',
  info: 'border-l-brand',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const variant = t.variant ?? 'info';
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 bg-bg-elevated p-4 shadow-lg backdrop-blur',
                STRIPE[variant],
              )}
            >
              <div className="mt-0.5">{ICONS[variant]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-fg">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs text-fg-muted">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-1 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
