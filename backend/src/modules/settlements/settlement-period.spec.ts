import { SettlementSchedule } from '../../generated/prisma/client';
import { nextScheduledDeadline } from './settlement-period';

describe('nextScheduledDeadline', () => {
  it('advances from the scheduled weekly deadline after an early payout', () => {
    expect(
      nextScheduledDeadline(
        new Date('2026-12-08T00:00:00.000Z'),
        SettlementSchedule.WEEKLY,
      ),
    ).toEqual(new Date('2026-12-15T00:00:00.000Z'));
  });

  it('advances semi-monthly and monthly deadlines by their calendar cadence', () => {
    expect(
      nextScheduledDeadline(
        new Date('2026-12-15T00:00:00.000Z'),
        SettlementSchedule.SEMI_MONTHLY,
      ),
    ).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    expect(
      nextScheduledDeadline(
        new Date('2026-12-31T00:00:00.000Z'),
        SettlementSchedule.MONTHLY,
      ),
    ).toEqual(new Date('2027-01-31T00:00:00.000Z'));
  });
});
