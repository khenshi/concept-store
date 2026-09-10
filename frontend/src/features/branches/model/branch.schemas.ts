import { z } from 'zod';

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`);

const optionalText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`)
    .transform((value) => value || undefined);

export const branchSchema = z.object({
  name: requiredText('Branch name', 120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => value === '' || /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value),
      'Code may contain uppercase letters, numbers, and internal hyphens.',
    )
    .refine(
      (value) => value === '' || (value.length >= 2 && value.length <= 32),
      'Code must contain 2–32 characters.',
    )
    .transform((value) => value || undefined),
  addressLine1: requiredText('Address line 1', 200),
  addressLine2: optionalText('Address line 2', 200),
  city: requiredText('City', 100),
  province: requiredText('Province', 100),
  postalCode: optionalText('Postal code', 20),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Enter a two-letter country code.'),
});
