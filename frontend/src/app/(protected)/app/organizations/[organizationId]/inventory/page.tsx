import { InventoryEntry } from '@/features/inventory/components/inventory-entry';
export default async function InventoryPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <InventoryEntry organizationId={organizationId} />;
}
