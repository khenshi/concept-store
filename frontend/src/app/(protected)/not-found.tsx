import { RouteRecovery } from '@/shared/components/ui/route-recovery';

export default function ProtectedNotFound() {
  return (
    <RouteRecovery
      title="Workspace page not found"
      description="This workspace page is unavailable or you no longer have access to it. Return to your organization list to continue."
      primaryHref="/app"
      primaryLabel="Back to organizations"
    />
  );
}
