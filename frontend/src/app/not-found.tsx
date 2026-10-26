import { RouteRecovery } from '@/shared/components/ui/route-recovery';

export default function GlobalNotFound() {
  return (
    <RouteRecovery
      title="Page not found"
      description="This page is unavailable or the link is no longer valid. Return to the home page to continue."
      primaryHref="/"
      primaryLabel="Back to home"
    />
  );
}
