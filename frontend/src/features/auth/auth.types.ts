export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegistrationCredentials extends Credentials {
  firstName: string;
  lastName: string;
  phone?: string;
}

export type AuthStatus =
  'loading' | 'authenticated' | 'unauthenticated' | 'error';
