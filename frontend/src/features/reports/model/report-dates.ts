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
const calendarDay = z
  .string()
  .trim()
  .refine(validDay, 'Enter a valid calendar date.');
export const reportDateRangeSchema = z
  .object({ fromDay: calendarDay, throughDay: calendarDay })
  .strict()
  .superRefine((range, context) => {
    if (!validDay(range.fromDay) || !validDay(range.throughDay)) return;
    const start = new Date(`${range.fromDay}T00:00:00.000+08:00`).getTime();
    const end =
      new Date(`${range.throughDay}T00:00:00.000+08:00`).getTime() +
      dayMilliseconds;
    if (end <= start)
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Through date must be on or after From date.',
      });
    else if (end - start > 366 * dayMilliseconds)
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Choose a period of 366 days or fewer.',
      });
    if (!/^\d{4}-/.test(new Date(end).toISOString()))
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Choose an earlier Through date.',
      });
  });
export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;

export function reportUtcRange(input: ReportDateRange) {
  const range = reportDateRangeSchema.parse(input);
  return {
    from: new Date(`${range.fromDay}T00:00:00.000+08:00`).toISOString(),
    until: new Date(
      new Date(`${range.throughDay}T00:00:00.000+08:00`).getTime() +
        dayMilliseconds,
    ).toISOString(),
  };
}
export function todayInPhilippines(now = new Date()): ReportDateRange {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  const today = `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
  return { fromDay: today, throughDay: today };
}
