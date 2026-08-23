import type { Metadata } from 'next';
import { AuthProvider } from '@/features/auth/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Concept Store Management System',
  description: 'Operations and merchant management for concept stores.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
