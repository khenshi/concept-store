import { MerchantSalesBranches } from '@/features/sales/components/merchant-sales-branches';
export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <MerchantSalesBranches organizationId={organizationId} />;
}
