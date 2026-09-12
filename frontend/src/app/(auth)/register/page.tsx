import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/components/credentials-form';

export const metadata: Metadata = { title: 'Create account | Kapwesto' };

export default function RegisterPage() {
  return <CredentialsForm mode="register" />;
}
