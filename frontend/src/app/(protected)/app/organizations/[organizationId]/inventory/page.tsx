import { InventoryOverview } from '@/features/inventory/inventory-overview';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    branchId?: string;
    merchantId?: string;
    productId?: string;
  }>;
}) {
  const { organizationId } = await params;
  const initialFilters = await searchParams;
  return (
    <InventoryOverview
      organizationId={organizationId}
      initialFilters={initialFilters}
    />
  );
}
