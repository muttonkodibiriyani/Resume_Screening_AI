/**
 * Zod schemas for every API input. Single source of truth for both
 * request validation and the typed API client.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const benchmarkCreateSchema = z.object({
  roleTitle: z.string().min(2).max(160),
  skillFamily: z.string().min(2).max(120).optional(),
  minExperience: z.coerce.number().int().min(0).max(50).optional(),
  seniority: z.string().min(2).max(80).optional(),
  domainContext: z.string().max(500).optional(),
  hiringNotes: z.string().max(4000).optional(),
});
export type BenchmarkCreateInput = z.infer<typeof benchmarkCreateSchema>;

export const benchmarkUpdateSchema = z.object({
  approvalStatus: z.enum(['draft', 'approved', 'archived']).optional(),
  idealSummary: z.string().max(2000).optional(),
  bumpVersion: z.boolean().optional(),
  weights: z
    .object({
      years: z.number().int().min(0).max(40),
      primarySkillDepth: z.number().int().min(0).max(50),
      architectureArtifacts: z.number().int().min(0).max(40),
      projectFootprint: z.number().int().min(0).max(40),
      leadership: z.number().int().min(0).max(40),
      modernization: z.number().int().min(0).max(40),
      certifications: z.number().int().min(0).max(20),
      communication: z.number().int().min(0).max(20),
    })
    .refine((w) => Object.values(w).reduce((a, b) => a + b, 0) === 100, { message: 'Weights must sum to 100' })
    .optional(),
});
export type BenchmarkUpdateInput = z.infer<typeof benchmarkUpdateSchema>;

export const decisionSchema = z
  .object({
    decision: z.enum(['shortlist', 'hold', 'reject']),
    comments: z.string().max(2000).optional(),
  })
  .refine((d) => d.decision === 'shortlist' || (d.comments && d.comments.length >= 5), {
    message: 'Comments are required (min 5 chars) for hold/reject decisions',
    path: ['comments'],
  });
export type DecisionInput = z.infer<typeof decisionSchema>;

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  userId: z.string().min(1).max(40).optional(),
  action: z.string().min(1).max(60).optional(),
});

export const candidatesQuerySchema = z.object({
  benchmarkId: z.string().min(1).max(40).optional(),
  search: z.string().max(120).optional(),
});

export const reportQuerySchema = z.object({
  format: z.enum(['csv', 'excel', 'xlsx', 'pdf']).default('csv'),
});

export const idParamSchema = z.object({ id: z.string().min(1).max(40) });

// File upload constraints
export const FILE_LIMITS = {
  maxBytesPerFile: 10 * 1024 * 1024, // 10 MB
  maxFiles: 50,
  allowedExtensions: ['.pdf', '.docx', '.txt'] as const,
  allowedMimeStarts: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ] as const,
};
