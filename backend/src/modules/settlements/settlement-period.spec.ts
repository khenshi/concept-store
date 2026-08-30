import { BadRequestException } from '@nestjs/common';
import { SettlementSchedule } from '../../generated/prisma/client';
import {
  daysInclusive,
  normalSettlementPeriod,
  parseSettlementPeriod,
  philippineDate,
} from './settlement-period';

describe('settlement period utilities', () => {
  it.each([
    [SettlementSchedule.WEEKLY, '2026-07-08', '2026-07-06', '2026-07-12'],
    [SettlementSchedule.SEMI_MONTHLY, '2026-07-08', '2026-07-01', '2026-07-15'],
    [SettlementSchedule.SEMI_MONTHLY, '2026-02-20', '2026-02-16', '2026-02-28'],
    [SettlementSchedule.MONTHLY, '2026-02-20', '2026-02-01', '2026-02-28'],
  ])('derives the %s calendar period', (schedule, date, start, end) => {
    expect(
      normalSettlementPeriod(new Date(`${date}T00:00:00.000Z`), schedule),
    ).toEqual({
      start: new Date(`${start}T00:00:00.000Z`),
      end: new Date(`${end}T00:00:00.000Z`),
    });
  });

  it('counts inclusive calendar days and converts timestamps to Philippine dates', () => {
    expect(
      daysInclusive(
        new Date('2026-07-16T00:00:00.000Z'),
        new Date('2026-07-31T00:00:00.000Z'),
      ),
    ).toBe(16);
    expect(philippineDate(new Date('2026-07-31T16:30:00.000Z'))).toEqual(
      new Date('2026-08-01T00:00:00.000Z'),
    );
  });

  it('rejects reversed and malformed period dates', () => {
    expect(() => parseSettlementPeriod('2026-07-31', '2026-07-01')).toThrow(
      new BadRequestException(
        'periodEnd must be after or equal to periodStart',
      ),
    );
    expect(() => parseSettlementPeriod('07/01/2026', '2026-07-31')).toThrow(
      new BadRequestException('periodStart must be a valid ISO date'),
    );
  });
});
