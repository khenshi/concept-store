'use client';

import { useAuth } from '@/features/auth/auth-context';
import { LogoutButton } from '@/features/auth/logout-button';

export default function AppPage() {
  const { user } = useAuth();

  return (
    <main className="app-shell">
      <header className="app-header">
        <span className="wordmark">Concept Store</span>
        <LogoutButton />
      </header>
      <section className="app-welcome" aria-labelledby="app-title">
        <p className="eyebrow">Account ready</p>
        <h1 id="app-title">You’re signed in.</h1>
        <p>
          Signed in as <strong>{user?.email}</strong>. Organization selection
          and role-based workspaces will be connected in the next implementation
          part.
        </p>
      </section>
    </main>
  );
}
