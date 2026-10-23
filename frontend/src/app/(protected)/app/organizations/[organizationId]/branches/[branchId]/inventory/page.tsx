import { redirect } from 'next/navigation';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ stockStatus?: string | string[] }>;
}) {
  const { organizationId, branchId } = await params;
  const requestedStatus = (await searchParams).stockStatus;
  const stockStatus =
    typeof requestedStatus === 'string' &&
    ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(requestedStatus)
      ? requestedStatus
      : undefined;
  redirect(
    `/app/organizations/${organizationId}/branches/${branchId}/inventory/stock${stockStatus ? `?stockStatus=${stockStatus}` : ''}`,
  );
}
