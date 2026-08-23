import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/features/auth/auth-context';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Concept Store Management System',
  description: 'Operations and merchant management for concept stores.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
