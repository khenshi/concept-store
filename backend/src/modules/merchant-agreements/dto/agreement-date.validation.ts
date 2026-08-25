import { BadRequestException } from '@nestjs/common';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseAgreementDate(value: string, fieldName: string): Date {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new BadRequestException(`${fieldName} must be a valid ISO date`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${fieldName} must be a valid ISO date`);
  }
  return date;
}

export function currentPhilippineBusinessDate(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

export function previousBusinessDate(date: Date): Date {
  const previous = new Date(date);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous;
}
