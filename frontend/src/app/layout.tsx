import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Concept Store Management System',
  description: 'Operations and merchant management for concept stores.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
