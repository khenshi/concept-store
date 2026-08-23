import { validateFrontendEnvironment } from './environment';

export const publicEnvironment = validateFrontendEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
