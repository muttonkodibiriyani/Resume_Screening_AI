import { describe, it, expect } from 'vitest';
import { scoreWithRules, estimateYears } from '@/lib/scoring/rule-engine';

describe('estimateYears', () => {
  it('reads explicit "X years"', () => {
    expect(estimateYears('I have 12+ years of experience')).toBe(12);
    expect(estimateYears('Over 8 yrs in cloud architecture')).toBe(8);
  });

  it('sums date ranges (months + years)', () => {
    const cv = `Jan 2015 - Dec 2018 Acme\nJan 2019 - Present BigCo`;
    const years = estimateYears(cv);
    expect(years).toBeGreaterThanOrEqual(3);
  });

  it('falls back to year-spread', () => {
    const cv = `Started in 2010, last role 2024`;
    expect(estimateYears(cv)).toBe(14);
  });

  it('returns 0 for empty input', () => {
    expect(estimateYears('')).toBe(0);
  });

  it('caps at 40 years', () => {
    expect(estimateYears('I have 60 years experience')).toBeLessThanOrEqual(40);
  });
});

describe('scoreWithRules', () => {
  const benchmark = {
    roleTitle: 'Senior Azure Integration Architect',
    minExperience: 10,
    primarySkills: ['Azure', 'Integration', 'API Management'],
    mandatorySkills: ['Logic Apps'],
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
    interviewQuestions: ['Walk me through your last HLD'],
    seniority: 'Architect',
  };

  it('penalises empty resume', () => {
    const r = scoreWithRules({ resumeText: '', candidateName: 'X', benchmark });
    expect(r.overallScore).toBeLessThan(30);
    expect(r.scoreBand).toBe('reject');
  });

  it('rewards full skill match + leadership + delivery', () => {
    const cv = `John Doe
12+ years experience.
Led a team of 10 engineers. Designed reference architecture (HLD, LLD).
Delivered production go-lives across Azure, Integration, API Management, Logic Apps.
Cloud-native, CI/CD, DevOps. Migrated multiple workloads.
AWS Certified.`;
    const r = scoreWithRules({ resumeText: cv, candidateName: 'John Doe', benchmark });
    expect(r.matchedSkills.length).toBeGreaterThanOrEqual(3);
    expect(r.overallScore).toBeGreaterThan(60);
  });

  it('detects title inflation red flag', () => {
    const cv = `Architect with 12 years experience. Worked on stuff.`;
    const r = scoreWithRules({ resumeText: cv, candidateName: 'X', benchmark });
    expect(r.redFlagsDetected.some((f) => /title inflation/i.test(f))).toBe(true);
  });

  it('clamps overall score to 100', () => {
    const r = scoreWithRules({
      resumeText: 'Azure Integration API Management Logic Apps '.repeat(50),
      candidateName: 'X',
      benchmark,
    });
    expect(r.overallScore).toBeLessThanOrEqual(100);
  });
});
