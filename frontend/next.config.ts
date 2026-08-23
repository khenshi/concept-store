import type { NextConfig } from 'next';
import { validateFrontendEnvironment } from './src/config/environment';

validateFrontendEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
