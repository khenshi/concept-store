import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/model/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kapwesto | Concept Store Foundation',
  description:
    'Kapwesto provides a secure multi-tenant foundation for concept store organizations, branches, and teams.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
