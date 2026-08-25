import { MerchantProfile } from '@/features/merchants/merchant-profile';

interface MerchantPageProps {
  params: Promise<{ organizationId: string; merchantId: string }>;
}

export default async function MerchantPage({ params }: MerchantPageProps) {
  const { organizationId, merchantId } = await params;
  return (
    <MerchantProfile organizationId={organizationId} merchantId={merchantId} />
  );
}
