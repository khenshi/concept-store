'use client';

import { RouteRecovery } from '@/shared/components/ui/route-recovery';
import './globals.css';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <RouteRecovery
          title="Kapwesto could not load"
          description="Something went wrong while opening Kapwesto. Try again, or return to the home page to continue."
          onRetry={reset}
          primaryHref="/"
          primaryLabel="Back to home"
        />
      </body>
    </html>
  );
}
