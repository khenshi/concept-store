import { InventoryOverview } from '@/features/inventory/inventory-overview';

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <InventoryOverview organizationId={organizationId} />;
}
