import { z } from 'zod';

const philippinePhonePattern = /^(?:\+63|0)(?:9\d{9}|[2-8]\d{8})$/;

function isPhilippinePhone(value: string) {
  return philippinePhonePattern.test(value.replace(/[\s()-]/g, ''));
}

export function sanitizePhilippinePhoneInput(value: string) {
  const allowedCharacters = value.trimStart().replace(/[^\d\s()+-]/g, '');
  const leadingPlus = allowedCharacters.startsWith('+') ? '+' : '';
  const withoutPlus = allowedCharacters
    .slice(leadingPlus ? 1 : 0)
    .replace(/\+/g, '');
  const maxDigits = leadingPlus ? 12 : 11;
  let digitCount = 0;
  let sanitized = '';

  for (const character of withoutPlus) {
    if (/\d/.test(character)) {
      if (digitCount >= maxDigits) continue;
      digitCount += 1;
    }
    sanitized += character;
  }

  return `${leadingPlus}${sanitized}`;
}

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
    .refine(
      (value) => !value || isPhilippinePhone(value),
      'Enter a valid Philippine phone number.',
    )
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
