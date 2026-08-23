import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/credentials-form';

export const metadata: Metadata = { title: 'Sign in | Concept Store' };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <CredentialsForm mode="login" />
    </main>
  );
}
