import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand text-brand-foreground',
        secondary: 'border-transparent bg-bg-muted text-fg',
        outline: 'border-border text-fg',
        success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
        danger: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
        info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
        gold: 'border-transparent bg-gold-500/15 text-gold-600 dark:text-gold-400',
        purple: 'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
        indigo: 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
        slate: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
