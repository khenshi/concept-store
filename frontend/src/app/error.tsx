'use client';

import { RouteRecovery } from '@/shared/components/ui/route-recovery';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <RouteRecovery
      title="This page could not be loaded"
      description="Something went wrong while opening this page. Try again, or return to the home page and continue from there."
      onRetry={reset}
      primaryHref="/"
      primaryLabel="Back to home"
    />
  );
}
