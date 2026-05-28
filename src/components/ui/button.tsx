'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-bg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-foreground shadow-sm hover:bg-brand/90',
        destructive: 'bg-danger text-white shadow-sm hover:bg-danger/90',
        outline: 'border border-border-strong bg-bg-elevated hover:bg-bg-muted',
        secondary: 'bg-bg-muted text-fg hover:bg-bg-muted/70',
        ghost: 'hover:bg-bg-muted text-fg',
        link: 'text-brand underline-offset-4 hover:underline',
        gold: 'bg-gold-500 text-maroon-900 shadow-sm hover:bg-gold-600',
        glass: 'bg-bg-elevated/80 backdrop-blur border border-border text-fg hover:bg-bg-muted',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-base',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    // Radix `Slot` requires exactly one React element child and merges props
    // into it - we cannot wrap it with our own spinner/text spans (that's
    // what produced "React.Children.only expected to receive a single React
    // element child" runtime errors). In asChild mode we therefore defer to
    // the caller's element entirely; the `loading` prop is a no-op there.
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        )}
        <span className={cn(loading && 'opacity-0', 'flex items-center gap-2')}>{children}</span>
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
