import { describe, it, expect } from 'vitest';
import { parseAIJson } from '@/lib/ai/json-parse';

describe('parseAIJson', () => {
  it('parses plain JSON', () => {
    expect(parseAIJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    expect(parseAIJson<{ x: string }>('```json\n{"x":"hi"}\n```')).toEqual({ x: 'hi' });
    expect(parseAIJson<{ x: string }>('```\n{"x":"hi"}\n```')).toEqual({ x: 'hi' });
  });

  it('finds embedded JSON inside chatty text', () => {
    expect(parseAIJson<{ ok: boolean }>('Sure! Here you go: {"ok":true} hope that helps.')).toEqual({ ok: true });
  });

  it('returns null on garbage', () => {
    expect(parseAIJson('definitely not json')).toBeNull();
    expect(parseAIJson('')).toBeNull();
  });

  it('handles nested braces', () => {
    expect(parseAIJson<{ a: { b: number } }>('{"a":{"b":1}}')).toEqual({ a: { b: 1 } });
  });
});
