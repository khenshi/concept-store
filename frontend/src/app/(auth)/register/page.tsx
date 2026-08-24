import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/credentials-form';

export const metadata: Metadata = { title: 'Create account | Concept Store' };

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <CredentialsForm mode="register" />
    </main>
  );
}
