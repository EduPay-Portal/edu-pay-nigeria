import { z } from 'zod';

/**
 * Profile validation schemas for students, parents, and admins
 */

// Phone number validation (Nigerian format)
const phoneSchema = z
  .string()
  .regex(
    /^(\+234|0)[789]\d{9}$/,
    'Invalid phone number. Use format: +2348012345678 or 08012345678'
  )
  .optional();

// Student profile validation
export const studentProfileSchema = z.object({
  admissionNumber: z
    .string()
    .min(5, 'Admission number must be at least 5 characters')
    .max(20, 'Admission number must be less than 20 characters')
    .regex(
      /^[A-Z0-9/-]+$/,
      'Admission number can only contain uppercase letters, numbers, slashes, and hyphens'
    ),
  classLevel: z
    .string()
    .min(1, 'Class level is required')
    .max(50, 'Class level must be less than 50 characters'),
  section: z.string().max(50).optional(),
  parentId: z.string().uuid('Invalid parent ID').optional(),
});

// Parent profile validation
export const parentProfileSchema = z.object({
  occupation: z
    .string()
    .max(100, 'Occupation must be less than 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  notificationPreference: z.enum(['sms', 'email', 'both'], {
    required_error: 'Notification preference is required',
  }),
  emergencyContact: phoneSchema,
});

// Admin profile validation
export const adminProfileSchema = z.object({
  department: z
    .string()
    .max(100, 'Department must be less than 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  accessLevel: z
    .number()
    .int('Access level must be an integer')
    .min(1, 'Access level must be at least 1')
    .max(5, 'Access level must be at most 5'),
});

// Profile update validation (personal info)
export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s'-]+$/,
      'First name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .transform((val) => val.trim()),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s'-]+$/,
      'Last name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .transform((val) => val.trim()),
  phoneNumber: phoneSchema,
});

// Edit student profile validation (admin only)
export const editStudentSchema = z.object({
  classLevel: z
    .string()
    .min(1, 'Class level is required')
    .max(50, 'Class level must be less than 50 characters'),
  section: z.string().max(50).optional().nullable(),
  schoolFees: z.coerce
    .number()
    .min(0, 'School fees cannot be negative')
    .optional(),
  debtBalance: z.coerce
    .number()
    .min(0, 'Debt balance cannot be negative')
    .optional(),
  membershipStatus: z.enum(['MEMBER', 'NMEMBER']).optional().nullable(),
  boardingStatus: z.enum(['DAY', 'BOARDER']).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  registrationNumber: z.string().max(50).optional().nullable(),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type ParentProfileInput = z.infer<typeof parentProfileSchema>;
export type AdminProfileInput = z.infer<typeof adminProfileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type EditStudentInput = z.infer<typeof editStudentSchema>;
