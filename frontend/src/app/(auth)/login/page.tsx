import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/components/credentials-form';

export const metadata: Metadata = { title: 'Sign in | Kapwesto' };

export default function LoginPage() {
  return <CredentialsForm mode="login" />;
}
