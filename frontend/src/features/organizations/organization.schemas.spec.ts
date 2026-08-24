import { createOrganizationSchema } from './organization.schemas';

describe('create organization schema', () => {
  it('trims a valid organization name', () => {
    expect(
      createOrganizationSchema.parse({ name: '  Common Ground  ' }),
    ).toEqual({ name: 'Common Ground' });
  });

  it('rejects a name shorter than two characters after trimming', () => {
    expect(createOrganizationSchema.safeParse({ name: ' A ' }).success).toBe(
      false,
    );
  });
});
