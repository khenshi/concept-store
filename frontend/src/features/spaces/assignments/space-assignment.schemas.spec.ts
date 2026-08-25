import {
  createSpaceAssignmentSchema,
  endSpaceAssignmentSchema,
} from './space-assignment.schemas';

describe('space assignment schemas', () => {
  it('accepts strict assignment inputs', () => {
    expect(
      createSpaceAssignmentSchema.safeParse({
        merchantId: '62e6c0c0-a55f-4d8e-bf42-f90c78fd28e5',
        startDate: '2026-08-25',
      }).success,
    ).toBe(true);
    expect(
      endSpaceAssignmentSchema.safeParse({ endDate: '2026-09-30' }).success,
    ).toBe(true);
  });

  it('rejects malformed and impossible business dates', () => {
    expect(
      endSpaceAssignmentSchema.safeParse({ endDate: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      endSpaceAssignmentSchema.safeParse({ endDate: '08/25/2026' }).success,
    ).toBe(false);
  });

  it('requires a merchant UUID', () => {
    expect(
      createSpaceAssignmentSchema.safeParse({
        merchantId: '',
        startDate: '2026-08-25',
      }).success,
    ).toBe(false);
  });
});
