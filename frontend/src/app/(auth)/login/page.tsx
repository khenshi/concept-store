import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/credentials-form';

export const metadata: Metadata = { title: 'Sign in | Concept Store' };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-white">
      <CredentialsForm mode="login" />
    </main>
  );
}
