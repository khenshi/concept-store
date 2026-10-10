import {
  occupancyDates,
  occupancySchema,
  spaceFormSchema,
  spacePageSchema,
} from './space.schemas';
import { occupancy, page, space } from './space.test-fixtures';
describe('Space validation', () => {
  it('normalizes labels and rejects blank or excessive fields', () => {
    expect(
      spaceFormSchema.parse({ name: ' Rack A1 ', type: ' Rack ' }),
    ).toEqual({ name: 'Rack A1', type: 'Rack' });
    expect(spaceFormSchema.safeParse({ name: ' ', type: 'Rack' }).success).toBe(
      false,
    );
    expect(
      spaceFormSchema.safeParse({ name: 'A', type: 'x'.repeat(81) }).success,
    ).toBe(false);
  });
  it('validates pagination and open/closed intervals', () => {
    expect(
      spacePageSchema.safeParse({ ...page([space]), totalPages: 20 }).success,
    ).toBe(false);
    expect(
      occupancySchema.safeParse({
        ...occupancy,
        endedAt: occupancy.startedAt,
        releaseReason: 'MANUAL',
      }).success,
    ).toBe(false);
    expect(
      occupancySchema.safeParse({ ...occupancy, releaseReason: 'MANUAL' })
        .success,
    ).toBe(false);
  });
  it('converts date inputs, permits action defaults, and rejects future/reversed dates', () => {
    expect(occupancyDates('', '')).toEqual({});
    expect(occupancyDates('2020-01-01', '2020-01-02')).toEqual({
      startedAt: '2020-01-01T00:00:00.000Z',
      endedAt: '2020-01-02T00:00:00.000Z',
    });
    expect(() => occupancyDates('2099-01-01', '')).toThrow('past or present');
    expect(() => occupancyDates('2020-01-02', '2020-01-01')).toThrow(
      'after start',
    );
  });
});
