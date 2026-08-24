import type { Metadata } from 'next';
import { CredentialsForm } from '@/features/auth/credentials-form';

export const metadata: Metadata = { title: 'Create account | Concept Store' };

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-white">
      <CredentialsForm mode="register" />
    </main>
  );
}
