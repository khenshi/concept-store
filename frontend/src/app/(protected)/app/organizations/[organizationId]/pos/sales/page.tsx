import { SalesHistory } from '@/features/pos/sales-history';

export default async function SalesHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { organizationId } = await params;
  const { branchId } = await searchParams;
  return (
    <SalesHistory organizationId={organizationId} initialBranchId={branchId} />
  );
}
