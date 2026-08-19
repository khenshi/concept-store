export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}
