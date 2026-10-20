import { BadRequestException } from '@nestjs/common';

export const REPORT_MIN_FROM = '1899-12-31T16:00:00.000Z';
export const REPORT_MAX_UNTIL = '9999-12-30T16:00:00.000Z';
export const DAY_MS = 86400000;
export type ReportGranularity = 'DAY' | 'MONTH' | 'YEAR';

const manilaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function calendarDay(date: Date) {
  const parts = manilaDate.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return (
    Date.parse(
      `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}T00:00:00Z`,
    ) / DAY_MS
  );
}

export function manilaMidnight(date: string) {
  const utc = Date.parse(`${date}T00:00:00Z`);
  const day = utc / DAY_MS;
  let lower = utc - DAY_MS;
  let upper = utc + DAY_MS;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (calendarDay(new Date(middle)) < day) lower = middle + 1;
    else upper = middle;
  }
  return new Date(lower);
}

export function validateReportUntil(value: string) {
  const until = new Date(value);
  if (
    !Number.isFinite(until.getTime()) ||
    until.getTime() <= Date.parse(REPORT_MIN_FROM) ||
    until.getTime() > Date.parse(REPORT_MAX_UNTIL)
  )
    throw new BadRequestException(
      'until must be within supported Manila dates 1900-01-01 through 9999-12-30',
    );
  return until;
}

export function reportRange(query: { from: string; until: string }) {
  const from = new Date(query.from);
  const until = validateReportUntil(query.until);
  if (
    !Number.isFinite(from.getTime()) ||
    from.getTime() < Date.parse(REPORT_MIN_FROM) ||
    from >= until
  )
    throw new BadRequestException(
      'from must precede until within supported Manila dates 1900-01-01 through 9999-12-30',
    );
  return { from, until };
}

export function reportGranularity(from: Date, until: Date): ReportGranularity {
  if (until.getTime() - from.getTime() <= 366 * DAY_MS) return 'DAY';
  const anniversary = new Date(from);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 5);
  if (anniversary.getUTCMonth() !== from.getUTCMonth())
    anniversary.setUTCDate(0);
  return until > anniversary ? 'YEAR' : 'MONTH';
}

export function reportDates(
  from: Date,
  until: Date,
  granularity: ReportGranularity,
  offset = 0,
  limit = Infinity,
): string[] {
  const first = calendarDay(from);
  const last = calendarDay(new Date(until.getTime() - 1));
  if (granularity === 'DAY')
    return Array.from(
      { length: Math.max(0, Math.min(last - first + 1 - offset, limit)) },
      (_, index) =>
        new Date((first + offset + index) * DAY_MS).toISOString().slice(0, 10),
    );
  const start = new Date(first * DAY_MS).toISOString().slice(0, 10);
  const end = new Date(last * DAY_MS).toISOString().slice(0, 10);
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  if (granularity === 'YEAR')
    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => `${String(firstYear + index).padStart(4, '0')}-01-01`,
    );
  const firstMonth = firstYear * 12 + Number(start.slice(5, 7)) - 1;
  const lastMonth = lastYear * 12 + Number(end.slice(5, 7)) - 1;
  return Array.from(
    { length: lastMonth - firstMonth + 1 },
    (_, index) =>
      `${String(Math.floor((firstMonth + index) / 12)).padStart(4, '0')}-${String(((firstMonth + index) % 12) + 1).padStart(2, '0')}-01`,
  );
}
