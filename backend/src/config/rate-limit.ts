import { hours, minutes } from '@nestjs/throttler';

export const STANDARD_RATE_LIMIT = {
  limit: 300,
  ttl: minutes(1),
} as const;

export const AUTH_RATE_LIMITS = {
  register: { limit: 5, ttl: hours(1) },
  login: { limit: 5, ttl: minutes(1) },
  refresh: { limit: 30, ttl: minutes(1) },
  logout: { limit: 30, ttl: minutes(1) },
} as const;

export const INVITATION_RATE_LIMITS = {
  preview: { limit: 20, ttl: minutes(1) },
  accept: { limit: 10, ttl: minutes(1) },
} as const;
