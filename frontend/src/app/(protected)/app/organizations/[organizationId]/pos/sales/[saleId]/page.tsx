import { SaleDetail } from '@/features/pos/sale-detail';

export default async function SaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; saleId: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { organizationId, saleId } = await params;
  const { branchId } = await searchParams;
  return (
    <SaleDetail
      organizationId={organizationId}
      branchId={branchId}
      saleId={saleId}
    />
  );
}
