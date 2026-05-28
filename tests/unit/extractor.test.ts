import { describe, it, expect } from 'vitest';
import { extractFromBuffer, guessCandidateName, guessEmail, guessPhone } from '@/lib/extraction/extractor';

describe('extractor TXT path', () => {
  it('extracts plain text', async () => {
    const long = 'Hello World. ' + 'Quick brown fox jumps over the lazy dog. '.repeat(5);
    const r = await extractFromBuffer(Buffer.from(long), 'cv.txt', 'text/plain');
    expect(r.status).toBe('success');
    expect(r.text).toContain('Hello World');
  });

  it('flags very short text as partial', async () => {
    const r = await extractFromBuffer(Buffer.from('hi'), 'cv.txt', 'text/plain');
    expect(r.status).toBe('partial');
  });
});

describe('extractor unsupported', () => {
  it('flags unknown extensions', async () => {
    const r = await extractFromBuffer(Buffer.from('xyz'), 'cv.zip', 'application/zip');
    expect(r.status).toBe('unsupported');
  });
});

describe('guessCandidateName', () => {
  it('finds a TitleCase name on line 1', () => {
    expect(guessCandidateName('John Doe\nAzure Architect\n+971 50 1234567')).toBe('John Doe');
  });

  it('falls back to email local-part', () => {
    expect(guessCandidateName('Some header\nContact: jane.smith@example.com')).toBe('Jane Smith');
  });

  it('returns null for nothing matching', () => {
    expect(guessCandidateName('CURRICULUM VITAE\n1234567')).toBeNull();
  });
});

describe('guessEmail / guessPhone', () => {
  it('finds email', () => {
    expect(guessEmail('reach me at foo.bar@x.io anytime')).toBe('foo.bar@x.io');
  });
  it('finds phone', () => {
    expect(guessPhone('+971 50 123 4567')).toBeTruthy();
  });
});
