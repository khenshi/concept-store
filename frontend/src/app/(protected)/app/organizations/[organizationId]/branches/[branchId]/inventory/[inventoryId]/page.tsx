import { InventoryDetail } from '@/features/inventory/components/inventory-detail';

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
    inventoryId: string;
  }>;
}) {
  const { organizationId, branchId, inventoryId } = await params;
  return (
    <InventoryDetail
      key={`${organizationId}/${branchId}/${inventoryId}`}
      organizationId={organizationId}
      branchId={branchId}
      inventoryId={inventoryId}
    />
  );
}
