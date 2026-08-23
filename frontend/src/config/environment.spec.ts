import { validateFrontendEnvironment } from './environment';

describe('validateFrontendEnvironment', () => {
  it('accepts an HTTP API URL', () => {
    expect(
      validateFrontendEnvironment({
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      }),
    ).toEqual({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' });
  });

  it('rejects a missing API URL', () => {
    expect(() => validateFrontendEnvironment({})).toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });

  it('rejects a non-HTTP URL', () => {
    expect(() =>
      validateFrontendEnvironment({ NEXT_PUBLIC_API_URL: 'ftp://example.com' }),
    ).toThrow('NEXT_PUBLIC_API_URL must use HTTP or HTTPS');
  });
});
