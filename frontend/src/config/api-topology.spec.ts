import { validateApiTopology } from './api-topology';

describe('validateApiTopology', () => {
  it('keeps direct API mode when no server-only upstream is configured', () => {
    expect(
      validateApiTopology({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' }),
    ).toEqual({ publicApiUrl: 'http://localhost:3000' });
  });

  it('creates a fixed origin-only rewrite for same-origin API mode', () => {
    expect(
      validateApiTopology({
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_URL: 'http://localhost:3001/api',
        NEXT_API_UPSTREAM_URL: 'http://localhost:3000/',
      }),
    ).toEqual({
      publicApiUrl: 'http://localhost:3001/api',
      upstreamUrl: 'http://localhost:3000',
      rewriteDestination: 'http://localhost:3000/:path*',
    });
  });

  it('rejects an upstream path, credentials or production HTTP origin', () => {
    expect(() =>
      validateApiTopology({
        NEXT_PUBLIC_API_URL: 'https://store.example/api',
        NEXT_API_UPSTREAM_URL: 'http://api.example.internal/v1',
        NODE_ENV: 'production',
      }),
    ).toThrow('only the upstream origin');

    expect(() =>
      validateApiTopology({
        NEXT_PUBLIC_API_URL: 'https://store.example/api',
        NEXT_API_UPSTREAM_URL: 'http://user:password@api.example.internal',
        NODE_ENV: 'production',
      }),
    ).toThrow('must not include credentials');

    expect(() =>
      validateApiTopology({
        NEXT_PUBLIC_API_URL: 'https://store.example/api',
        NEXT_API_UPSTREAM_URL: 'http://api.example.internal',
        NODE_ENV: 'production',
      }),
    ).toThrow('must use HTTPS');
  });

  it('requires the public API base to be the same-origin /api path', () => {
    expect(() =>
      validateApiTopology({
        NEXT_PUBLIC_API_URL: 'https://store.example/auth',
        NEXT_API_UPSTREAM_URL: 'https://api.example.internal',
        NODE_ENV: 'production',
      }),
    ).toThrow('must end at /api');
  });
});
