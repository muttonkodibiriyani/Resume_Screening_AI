'use client';
import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export interface RadialDim {
  key: string;
  label: string;
  value: number;
  weight: number;
}

interface ScoreRadialProps {
  dims: RadialDim[];
  overall: number;
  size?: number;
  className?: string;
}

const COLORS = ['#6B1F2E', '#8C2D40', '#A8485B', '#C57080', '#D89AA4', '#E8C2C8', '#D4B25E', '#A8843A'];

export function ScoreRadial({ dims, overall, size = 280, className }: ScoreRadialProps) {
  const data = dims.map((d, i) => ({
    name: d.label,
    value: Math.round((d.value / Math.max(d.weight, 1)) * 100),
    raw: d.value,
    weight: d.weight,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="38%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={6} />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _name: string, item) => {
              const raw = item.payload.raw;
              const weight = item.payload.weight;
              return [`${raw}/${weight} (${value}%)`, item.payload.name];
            }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="tabular text-display-md font-bold text-fg">{overall}</div>
          <div className="text-xs font-medium uppercase tracking-wider text-fg-muted">overall</div>
        </div>
      </div>
    </div>
  );
}
