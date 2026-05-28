/**
 * Role-Based Access Control - single source of truth for permissions.
 *
 * Roles:
 *   admin           - everything
 *   hiring_manager  - approve benchmarks, decide candidates, download reports
 *   recruiter       - create benchmarks, upload resumes, decide candidates
 *   interview_panel - read benchmarks + candidates, no decisions
 *   viewer          - read-only (leadership / SLT)
 *
 * Add new actions here; routes call `can(user, action)` (or `requireRole(...)`).
 */
import type { SessionUser } from './auth';
import { AuthError, requireAuth } from './auth';

export type Role = 'admin' | 'hiring_manager' | 'recruiter' | 'interview_panel' | 'viewer';

export const ALL_ROLES: Role[] = ['admin', 'hiring_manager', 'recruiter', 'interview_panel', 'viewer'];

export type Action =
  // Benchmarks
  | 'benchmark:read'
  | 'benchmark:create'
  | 'benchmark:update'
  | 'benchmark:approve'
  | 'benchmark:delete'
  | 'benchmark:bump_version'
  // Candidates
  | 'candidate:read'
  | 'candidate:upload'
  | 'candidate:rescore'
  | 'candidate:delete'
  // Decisions
  | 'decision:write'
  // Reports
  | 'report:download'
  // Audit
  | 'audit:read'
  | 'audit:export'
  // Admin
  | 'admin:users'
  | 'admin:settings';

const PERMISSIONS: Record<Action, Role[]> = {
  'benchmark:read': ['admin', 'hiring_manager', 'recruiter', 'interview_panel', 'viewer'],
  'benchmark:create': ['admin', 'recruiter', 'hiring_manager'],
  'benchmark:update': ['admin', 'recruiter', 'hiring_manager'],
  'benchmark:approve': ['admin', 'hiring_manager'],
  'benchmark:delete': ['admin'],
  'benchmark:bump_version': ['admin', 'hiring_manager'],

  'candidate:read': ['admin', 'hiring_manager', 'recruiter', 'interview_panel', 'viewer'],
  'candidate:upload': ['admin', 'recruiter'],
  'candidate:rescore': ['admin', 'recruiter'],
  'candidate:delete': ['admin'],

  'decision:write': ['admin', 'recruiter', 'hiring_manager'],

  'report:download': ['admin', 'hiring_manager', 'recruiter', 'viewer'],

  'audit:read': ['admin', 'hiring_manager'],
  'audit:export': ['admin'],

  'admin:users': ['admin'],
  'admin:settings': ['admin'],
};

export function can(user: SessionUser | null, action: Action): boolean {
  if (!user) return false;
  return PERMISSIONS[action].includes(user.role);
}

export async function requirePermission(action: Action): Promise<SessionUser> {
  const u = await requireAuth();
  if (!can(u, action)) {
    throw new AuthError('FORBIDDEN', `Role '${u.role}' is not permitted to '${action}'`);
  }
  return u;
}

/** UI helper - returns the human-readable label for a role. */
export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    admin: 'Administrator',
    hiring_manager: 'Hiring Manager',
    recruiter: 'Recruiter',
    interview_panel: 'Interview Panel',
    viewer: 'Viewer / SLT',
  };
  return map[role];
}
