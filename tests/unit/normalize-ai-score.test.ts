import { describe, it, expect } from 'vitest';
import { normalizeAIScore } from '@/lib/scoring/ai-engine';

const bench = {
  roleTitle: 'Test',
  minExperience: 5,
  weights: {
    years: 10,
    primarySkillDepth: 25,
    architectureArtifacts: 20,
    projectFootprint: 15,
    leadership: 10,
    modernization: 10,
    certifications: 5,
    communication: 5,
  },
};

describe('normalizeAIScore', () => {
  it('clamps oversized component values to their weight', () => {
    const r = normalizeAIScore(
      {
        overallScore: 200,
        breakdown: {
          years: 99,
          primarySkillDepth: 99,
          architectureArtifacts: 99,
          projectFootprint: 99,
          leadership: 99,
          modernization: 99,
          certifications: 99,
          communication: 99,
        },
      },
      bench,
      'X',
    );
    expect(r.breakdown.years).toBeLessThanOrEqual(10);
    expect(r.breakdown.primarySkillDepth).toBeLessThanOrEqual(25);
    expect(r.overallScore).toBeLessThanOrEqual(100);
  });

  it('uses the clamped sum if AI overall is wildly off', () => {
    const r = normalizeAIScore(
      {
        overallScore: 95,
        breakdown: {
          years: 0,
          primarySkillDepth: 0,
          architectureArtifacts: 0,
          projectFootprint: 0,
          leadership: 0,
          modernization: 0,
          certifications: 0,
          communication: 0,
        },
      },
      bench,
      'X',
    );
    expect(r.overallScore).toBe(0);
  });

  it('keeps AI overall when within 5 points of sum', () => {
    const r = normalizeAIScore(
      {
        overallScore: 60,
        breakdown: {
          years: 5,
          primarySkillDepth: 15,
          architectureArtifacts: 10,
          projectFootprint: 10,
          leadership: 5,
          modernization: 5,
          certifications: 3,
          communication: 3,
        },
      },
      bench,
      'X',
    );
    expect(r.overallScore).toBe(60);
  });

  it('assigns score band from overall', () => {
    const r = normalizeAIScore(
      {
        overallScore: 92,
        breakdown: {
          years: 10,
          primarySkillDepth: 25,
          architectureArtifacts: 20,
          projectFootprint: 15,
          leadership: 10,
          modernization: 10,
          certifications: 5,
          communication: 5,
        },
      },
      bench,
      'X',
    );
    expect(r.scoreBand).toBe('ideal');
  });
});
