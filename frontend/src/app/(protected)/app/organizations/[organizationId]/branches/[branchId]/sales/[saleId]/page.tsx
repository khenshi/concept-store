import { SaleDetail } from '@/features/sales/components/sale-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string; saleId: string }>;
}) {
  const scope = await params;
  return <SaleDetail {...scope} />;
}
