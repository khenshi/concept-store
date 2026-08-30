import { SaleReceipt } from '@/features/pos/sale-receipt';

export default async function SaleReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; saleId: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { organizationId, saleId } = await params;
  const { branchId } = await searchParams;
  return (
    <SaleReceipt
      organizationId={organizationId}
      branchId={branchId}
      saleId={saleId}
    />
  );
}
