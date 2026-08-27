import { z } from 'zod';

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
  password: z
    .string()
    .min(12, 'Password must contain at least 12 characters.')
    .max(128, 'Password must contain 128 characters or fewer.'),
});

export type AuthFormValues = z.infer<typeof loginSchema>;
export type RegistrationFormValues = z.infer<typeof registrationSchema>;
