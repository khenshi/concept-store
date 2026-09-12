import { InventoryDirectory } from '@/features/inventory/components/inventory-directory';

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  return (
    <InventoryDirectory
      key={`${organizationId}/${branchId}`}
      organizationId={organizationId}
      branchId={branchId}
    />
  );
}
