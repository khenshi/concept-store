import { spaceSchema } from './space.schemas';

describe('space schema', () => {
  it('normalizes a predefined space type', () => {
    expect(
      spaceSchema.parse({
        code: ' rack-a01 ',
        name: ' Front display rack ',
        type: 'RACK',
        customType: '',
        status: 'ACTIVE',
      }),
    ).toEqual({
      code: 'RACK-A01',
      name: 'Front display rack',
      type: 'RACK',
      customType: undefined,
      status: 'ACTIVE',
    });
  });

  it('requires a description for a custom space type', () => {
    const result = spaceSchema.safeParse({
      code: 'CUSTOM-01',
      name: 'Window area',
      type: 'CUSTOM',
      customType: '',
      status: 'ACTIVE',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.customType).toContain(
        'Describe the custom space type.',
      );
    }
  });

  it('rejects a one-character custom type description', () => {
    expect(
      spaceSchema.safeParse({
        code: 'CUSTOM-01',
        name: 'Window area',
        type: 'CUSTOM',
        customType: 'X',
        status: 'ACTIVE',
      }).success,
    ).toBe(false);
  });

  it('rejects custom descriptions for predefined types', () => {
    expect(
      spaceSchema.safeParse({
        code: 'RACK-01',
        name: 'Window rack',
        type: 'RACK',
        customType: 'Window area',
        status: 'ACTIVE',
      }).success,
    ).toBe(false);
  });
});
