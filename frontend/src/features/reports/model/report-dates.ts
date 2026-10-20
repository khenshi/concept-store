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
    if (range.fromDay < '1900-01-01' || range.throughDay < '1900-01-01') {
      context.addIssue({
        code: 'custom',
        path: ['fromDay'],
        message: 'Choose dates on or after January 1, 1900.',
      });
      return;
    }
    if (range.throughDay > '9999-12-30') {
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Choose an earlier Through date.',
      });
      return;
    }
    const start = manilaMidnight(range.fromDay).getTime();
    const end = manilaMidnight(nextDay(range.throughDay)).getTime();
    if (end <= start)
      context.addIssue({
        code: 'custom',
        path: ['throughDay'],
        message: 'Through date must be on or after From date.',
      });
  });
export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;

export const reportPresets = [
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LAST_12_MONTHS', label: 'Last 12 months' },
  { value: 'LAST_2_YEARS', label: 'Last 2 years' },
  { value: 'ALL_TIME', label: 'All time' },
  { value: 'CUSTOM', label: 'Custom dates' },
] as const;
export type ReportPreset = (typeof reportPresets)[number]['value'];

export function reportPresetDates(
  preset: Exclude<ReportPreset, 'CUSTOM' | 'ALL_TIME'>,
  now = new Date(),
): ReportDateRange {
  const today = todayInPhilippines(now);
  const date = new Date(`${today.fromDay}T00:00:00Z`);
  if (preset === 'THIS_MONTH') date.setUTCDate(1);
  if (preset === 'THIS_YEAR') date.setUTCMonth(0, 1);
  if (preset === 'LAST_30_DAYS') date.setUTCDate(date.getUTCDate() - 29);
  if (preset === 'LAST_12_MONTHS' || preset === 'LAST_2_YEARS') {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(
      date.getUTCMonth() - (preset === 'LAST_12_MONTHS' ? 12 : 24),
    );
    const last = new Date(date.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, last.getUTCDate()));
  }
  return {
    fromDay: date.toISOString().slice(0, 10),
    throughDay: today.throughDay,
  };
}

export function reportCalendarRange(
  from: string,
  until: string,
): ReportDateRange {
  return {
    fromDay: todayInPhilippines(new Date(from)).fromDay,
    throughDay: todayInPhilippines(new Date(Date.parse(until) - 1)).fromDay,
  };
}

export function reportUtcRange(input: ReportDateRange) {
  const range = reportDateRangeSchema.parse(input);
  return {
    from: manilaMidnight(range.fromDay).toISOString(),
    until: manilaMidnight(nextDay(range.throughDay)).toISOString(),
  };
}

function nextDay(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + dayMilliseconds)
    .toISOString()
    .slice(0, 10);
}

function manilaMidnight(day: string) {
  const utc = Date.parse(`${day}T00:00:00Z`);
  let low = utc - dayMilliseconds;
  let high = utc + dayMilliseconds;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (todayInPhilippines(new Date(middle)).fromDay < day) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
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
