'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  InventoryScope,
  InventoryStockStatus,
} from '../model/inventory.types';
import { InventoryDirectory, type InventoryTab } from './inventory-directory';

export function InventoryRouteWorkspace(scope: InventoryScope) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory`;
  const segment = pathname.slice(base.length + 1);
  const selectedTab: InventoryTab =
    segment === 'movements' || segment === 'integrity' ? segment : 'stock';
  const status = searchParams.get('stockStatus');
  const initialStockStatus =
    status && ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(status)
      ? (status as InventoryStockStatus)
      : undefined;
  return (
    <InventoryDirectory
      {...scope}
      initialStockStatus={initialStockStatus}
      selectedTab={selectedTab}
      onTabChange={(tab) => {
        const query = searchParams.toString();
        router.push(`${base}/${tab}${query ? `?${query}` : ''}`, {
          scroll: false,
        });
      }}
    />
  );
}
