import { z } from 'zod';

export const updateProfileSchema = z.object({
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
});

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Enter your current password.')
      .max(128, 'Password must contain 128 characters or fewer.'),
    newPassword: z
      .string()
      .min(12, 'New password must contain at least 12 characters.')
      .max(128, 'New password must contain 128 characters or fewer.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'New password must be different from your current password.',
    path: ['newPassword'],
  });

export const deleteAccountSchema = z.object({
  password: z
    .string()
    .min(1, 'Enter your password to continue.')
    .max(128, 'Password must contain 128 characters or fewer.'),
});
