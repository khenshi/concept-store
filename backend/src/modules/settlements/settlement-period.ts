import { BadRequestException } from '@nestjs/common';
import { SettlementSchedule } from '../../generated/prisma/client';
import { parseAgreementDate } from '../merchant-agreements/dto/agreement-date.validation';

export interface DatePeriod {
  start: Date;
  end: Date;
}

export function parseSettlementPeriod(
  periodStart: string,
  periodEnd: string,
): DatePeriod {
  const start = parseAgreementDate(periodStart, 'periodStart');
  const end = parseAgreementDate(periodEnd, 'periodEnd');
  if (end < start) {
    throw new BadRequestException(
      'periodEnd must be after or equal to periodStart',
    );
  }
  return { start, end };
}

export function normalSettlementPeriod(
  date: Date,
  schedule: SettlementSchedule,
): DatePeriod {
  const start = new Date(date);
  const end = new Date(date);

  if (schedule === SettlementSchedule.WEEKLY) {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    start.setUTCDate(date.getUTCDate() - daysSinceMonday);
    end.setTime(start.getTime());
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (schedule === SettlementSchedule.SEMI_MONTHLY) {
    if (date.getUTCDate() <= 15) {
      start.setUTCDate(1);
      end.setUTCDate(15);
    } else {
      start.setUTCDate(16);
      end.setUTCMonth(date.getUTCMonth() + 1, 0);
    }
  } else {
    start.setUTCDate(1);
    end.setUTCMonth(date.getUTCMonth() + 1, 0);
  }

  return { start, end };
}

export function daysInclusive(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function nextBusinessDate(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function philippineDate(value: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const fields = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue]),
  );
  return new Date(`${fields.year}-${fields.month}-${fields.day}T00:00:00.000Z`);
}

export function philippineDayStart(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00+08:00`);
}
