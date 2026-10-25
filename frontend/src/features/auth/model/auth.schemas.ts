import { z } from 'zod';

export const newPasswordSchema = z
  .string()
  .refine(
    (value) => Array.from(value).length >= 12,
    'Password must contain at least 12 characters.',
  )
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 72,
    'Password must be 72 UTF-8 bytes or fewer. Some characters use more than one byte.',
  );

export const activeSessionSchema = z.strictObject({
  id: z.uuid(),
  isCurrent: z.boolean(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const activeSessionPageSchema = z
  .strictObject({
    items: z.array(activeSessionSchema).max(15),
    page: z.number().int().min(1).max(1_000_000),
    pageSize: z.literal(15),
    total: z.number().int().nonnegative().safe(),
    totalPages: z.number().int().nonnegative().safe(),
  })
  .refine(
    (value) =>
      value.totalPages === Math.ceil(value.total / value.pageSize) &&
      value.items.length ===
        Math.min(15, Math.max(0, value.total - (value.page - 1) * 15)) &&
      new Set(value.items.map((item) => item.id)).size === value.items.length &&
      value.items.filter((item) => item.isCurrent).length <= 1,
  );

export type ActiveSession = z.infer<typeof activeSessionSchema>;
export type ActiveSessionPage = z.infer<typeof activeSessionPageSchema>;

const email = z
  .email('Enter a valid email address.')
  .max(254, 'Email must be 254 characters or fewer.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const registrationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Enter your first name.')
    .max(80, 'First name must be 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Enter your last name.')
    .max(80, 'Last name must be 80 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .max(25, 'Phone number must be 25 characters or fewer.')
    .optional()
    .transform((value) => value || undefined),
  email,
});

export type AuthFormValues = z.infer<typeof loginSchema>;
export type RegistrationFormValues = z.infer<typeof registrationSchema>;
