import type { ColorTheme } from '../../generated/prisma/client';

export interface AuthenticatedPrincipal {
  id: string;
  email: string;
}

export interface AuthenticatedUser extends AuthenticatedPrincipal {
  firstName: string;
  lastName: string;
  phone: string | null;
  colorTheme: ColorTheme;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface RefreshSession {
  token: string;
  expiresAt: Date;
}

export interface AuthSessionResponse {
  response: AuthResponse;
  refreshSession: RefreshSession;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}
