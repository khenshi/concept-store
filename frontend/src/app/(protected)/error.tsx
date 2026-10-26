'use client';

import { RouteRecovery } from '@/shared/components/ui/route-recovery';

export default function ProtectedError({ reset }: { reset: () => void }) {
  return (
    <RouteRecovery
      title="This workspace could not be loaded"
      description="The workspace did not finish loading. Try again, or return to your organization list without repeating any pending action."
      onRetry={reset}
      primaryHref="/app"
      primaryLabel="Back to organizations"
    />
  );
}
