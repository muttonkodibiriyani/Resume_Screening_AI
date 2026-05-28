export interface ScoreBreakdown {
  years: number;
  primarySkillDepth: number;
  architectureArtifacts: number;
  projectFootprint: number;
  leadership: number;
  modernization: number;
  certifications: number;
  communication: number;
}

export interface CandidateScore {
  candidateName: string;
  targetRole: string;
  totalExperience: number;
  relevantExperience: number;
  overallScore: number;
  scoreBand: 'ideal' | 'strong' | 'borderline' | 'reject';
  recommendation: string;
  risk: 'low' | 'medium' | 'high';
  breakdown: ScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  partiallyEvidencedSkills: string[];
  matchedEvidence: string[];
  missingOrWeakEvidence: string[];
  redFlagsDetected: string[];
  strengths: string[];
  gaps: string[];
  interviewFocusAreas: string[];
  interviewQuestions: string[];
  finalSummary: string;
}
