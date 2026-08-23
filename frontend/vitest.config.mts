import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
