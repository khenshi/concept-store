import type { NextConfig } from 'next';
import { validateApiTopology } from './src/config/api-topology';

const apiTopology = validateApiTopology({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_API_UPSTREAM_URL: process.env.NEXT_API_UPSTREAM_URL,
  NODE_ENV: process.env.NODE_ENV,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['macbook-air-4.tailf876a2.ts.net'],
  async rewrites() {
    if (!apiTopology.rewriteDestination) return [];

    return [
      {
        source: '/api/:path*',
        destination: apiTopology.rewriteDestination,
      },
    ];
  },
};

export default nextConfig;
