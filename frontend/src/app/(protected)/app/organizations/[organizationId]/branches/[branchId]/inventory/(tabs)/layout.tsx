import { Suspense, type ReactNode } from 'react';
import { InventoryRouteWorkspace } from '@/features/inventory/components/inventory-route-workspace';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';

export default async function InventoryTabsLayout({
  params,
  children,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
  children: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<ListSkeleton label="Loading inventory workspace" />}>
        <InventoryRouteWorkspace {...await params} />
      </Suspense>
      {children}
    </>
  );
}
