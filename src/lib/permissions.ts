import type { AppRole } from '@/types/auth';

export const STAFF_ROLES: AppRole[] = ['admin', 'principal', 'bursar', 'registrar', 'auditor'];

export const isStaff = (role: AppRole | null | undefined) => !!role && STAFF_ROLES.includes(role);

/** Which roles can open each admin page. Admin (IT) always has full access. */
export const ADMIN_PAGE_ROLES = {
  dashboard: ['admin', 'principal', 'bursar', 'registrar', 'auditor'],
  status: ['admin'],
  students: ['admin', 'principal', 'bursar', 'registrar', 'auditor'],
  parents: ['admin', 'principal', 'bursar', 'registrar', 'auditor'],
  transactions: ['admin', 'principal', 'bursar', 'auditor'],
  bulkImport: ['admin', 'registrar'],
  dva: ['admin', 'principal', 'bursar', 'registrar', 'auditor'],
  /** Re-issue / retire virtual account buttons on the DVA page. */
  dvaActions: ['admin'],
  settlements: ['admin', 'principal', 'bursar', 'auditor'],
  paymentSimulator: ['admin'],
  webhooks: ['admin'],
  reconciliation: ['admin'],
  audit: ['admin', 'principal', 'auditor'],
  settings: ['admin'],
} satisfies Record<string, AppRole[]>;

export const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  parent: 'Parent',
  admin: 'IT Admin',
  principal: 'Principal',
  bursar: 'Bursar',
  registrar: 'Registrar',
  auditor: 'Auditor',
};

export const homeForRole = (role: AppRole | null | undefined) =>
  role === 'student' ? '/dashboard/student' : role === 'parent' ? '/dashboard/parent' : '/dashboard/admin';
