import { InventoryDirectory } from '@/features/inventory/components/inventory-directory';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ stockStatus?: string | string[] }>;
}) {
  const { organizationId, branchId } = await params;
  const requestedStatus = (await searchParams).stockStatus;
  const initialStockStatus =
    typeof requestedStatus === 'string' &&
    ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(requestedStatus)
      ? (requestedStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK')
      : undefined;
  return (
    <InventoryDirectory
      key={`${organizationId}/${branchId}`}
      organizationId={organizationId}
      branchId={branchId}
      initialStockStatus={initialStockStatus}
    />
  );
}
