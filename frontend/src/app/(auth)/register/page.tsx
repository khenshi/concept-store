import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/credentials-form';

export const metadata: Metadata = { title: 'Register | Concept Store' };

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <CredentialsForm mode="register" />
    </main>
  );
}
