'use client';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { type AIEngine, engineBadgeColor, engineToLabel } from '@/lib/ai/config';
import { Cpu, Cloud, AlertTriangle, Zap, Lock } from 'lucide-react';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

function mapVariant(c: string): BadgeVariant {
  if (c === 'blue') return 'info';
  if (c === 'indigo') return 'indigo';
  if (c === 'purple') return 'purple';
  if (c === 'amber') return 'warning';
  if (c === 'slate') return 'slate';
  return 'secondary';
}

export function EngineBadge({ engine }: { engine: AIEngine | string }) {
  const variant = mapVariant(engineBadgeColor(engine as AIEngine));
  const label = engineToLabel(engine as AIEngine);
  const Icon = engine.includes('local')
    ? AlertTriangle
    : engine === 'gemini' || engine === 'gemini+search'
      ? Zap
      : engine === 'azure-openai' || engine === 'azure+search'
        ? Cloud
        : engine === 'copilot-studio'
          ? Lock
          : Cpu;
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}
