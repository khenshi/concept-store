export type ColorTheme =
  | 'GRAPHITE'
  | 'OCEAN'
  | 'FOREST'
  | 'PLUM'
  | 'POLLUX_LIGHT'
  | 'SKYDASH_LIGHT'
  | 'STAR_ADMIN_LIGHT'
  | 'AZIA_LIGHT'
  | 'PURPLE_LIGHT'
  | 'PLUS_ADMIN_LIGHT'
  | 'BREEZE_LIGHT'
  | 'STELLAR_DARK'
  | 'CORONA_DARK'
  | 'JUSTDO_DARK'
  | 'SYPHER_LIGHT'
  | 'CREXTIO_WARM'
  | 'SBB_INDUSTRIAL'
  | 'WELLNESS_TEAL';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  colorTheme: ColorTheme;
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

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountInput {
  password: string;
}

export type AuthStatus =
  'loading' | 'authenticated' | 'unauthenticated' | 'error';
