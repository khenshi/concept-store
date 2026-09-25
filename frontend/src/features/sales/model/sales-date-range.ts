import { z } from 'zod';

const dayMilliseconds = 86400000;

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const optionalCalendarDay = z.preprocess(
  (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
  z.string().trim().refine(validDay, 'Enter a valid calendar date.').optional(),
);

export const salesDateRangeSchema = z
  .object({
    fromDay: optionalCalendarDay,
    throughDay: optionalCalendarDay,
  })
  .strict()
  .superRefine((range, context) => {
    if (!range.fromDay || !range.throughDay) return;
    const start = manilaMidnight(range.fromDay).getTime();
    const end = nextManilaMidnight(range.throughDay).getTime();
    if (end <= start)
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Through date must be on or after From date.',
      });
  });

export type SalesDateRange = z.infer<typeof salesDateRangeSchema>;

function manilaMidnight(day: string) {
  return new Date(`${day}T00:00:00.000+08:00`);
}

function nextManilaMidnight(day: string) {
  return new Date(manilaMidnight(day).getTime() + dayMilliseconds);
}

export function salesUtcRange(input: SalesDateRange) {
  const range = salesDateRangeSchema.parse(input);
  return {
    ...(range.fromDay
      ? { from: manilaMidnight(range.fromDay).toISOString() }
      : {}),
    ...(range.throughDay
      ? { until: nextManilaMidnight(range.throughDay).toISOString() }
      : {}),
  };
}
