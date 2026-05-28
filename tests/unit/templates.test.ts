import { describe, it, expect } from 'vitest';
import { findTemplateByRole, BENCHMARK_TEMPLATES } from '@/lib/benchmarks/templates';

describe('findTemplateByRole', () => {
  it('returns nothing for empty / whitespace input', () => {
    expect(findTemplateByRole('')).toBeUndefined();
    expect(findTemplateByRole('   ')).toBeUndefined();
  });

  it('matches by overlapping skill-family tokens', () => {
    const tpl = findTemplateByRole('Senior Azure Integration Architect');
    expect(tpl).toBeDefined();
    expect(tpl?.skillFamily.toLowerCase()).toMatch(/azure|integration/);
  });

  it('matches Oracle EBS roles', () => {
    const tpl = findTemplateByRole('Oracle EBS Lead');
    if (tpl) expect(tpl.skillFamily.toLowerCase()).toMatch(/oracle/);
  });

  it('does not throw on every template', () => {
    for (const t of BENCHMARK_TEMPLATES) {
      expect(() => findTemplateByRole(t.roleTitle)).not.toThrow();
    }
  });
});
