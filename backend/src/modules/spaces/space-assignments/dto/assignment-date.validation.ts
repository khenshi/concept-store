import { BadRequestException } from '@nestjs/common';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBusinessDate(value: string, fieldName: string): Date {
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
