import { MerchantProfile } from '@/features/merchants/components/merchant-profile';

export default async function MerchantProfilePage({
  params,
}: {
  params: Promise<{ organizationId: string; merchantId: string }>;
}) {
  const { organizationId, merchantId } = await params;
  return (
    <MerchantProfile organizationId={organizationId} merchantId={merchantId} />
  );
}
