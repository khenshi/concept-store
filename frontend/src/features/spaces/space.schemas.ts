import { z } from 'zod';

export const spaceTypeSchema = z.enum([
  'RACK',
  'SHELF',
  'CABINET',
  'BOOTH',
  'TABLE',
  'DRAWER',
  'CUSTOM',
]);

export const spaceStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const spaceSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Code must contain at least 2 characters.')
      .max(32, 'Code must contain 32 characters or fewer.')
      .regex(
        /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
        'Code may contain uppercase letters, numbers, and internal hyphens.',
      ),
    name: z
      .string()
      .trim()
      .min(2, 'Space name must contain at least 2 characters.')
      .max(120, 'Space name must contain 120 characters or fewer.'),
    type: spaceTypeSchema,
    customType: z
      .string()
      .trim()
      .max(80, 'Custom type must contain 80 characters or fewer.')
      .transform((value) => value || undefined),
    status: spaceStatusSchema,
  })
  .superRefine((value, context) => {
    if (value.type === 'CUSTOM' && !value.customType) {
      context.addIssue({
        code: 'custom',
        path: ['customType'],
        message: 'Describe the custom space type.',
      });
    } else if (
      value.type === 'CUSTOM' &&
      value.customType !== undefined &&
      value.customType.length < 2
    ) {
      context.addIssue({
        code: 'custom',
        path: ['customType'],
        message: 'Custom type must contain at least 2 characters.',
      });
    }
    if (value.type !== 'CUSTOM' && value.customType) {
      context.addIssue({
        code: 'custom',
        path: ['customType'],
        message: 'Custom type is available only when type is Custom.',
      });
    }
  });
