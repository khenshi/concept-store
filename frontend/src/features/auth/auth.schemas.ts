import { z } from 'zod';

const email = z
  .email('Enter a valid email address.')
  .max(254, 'Email must be 254 characters or fewer.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const registrationSchema = z.object({
  email,
  password: z
    .string()
    .min(12, 'Password must contain at least 12 characters.')
    .max(128, 'Password must contain 128 characters or fewer.'),
});

export type AuthFormValues = z.infer<typeof loginSchema>;
