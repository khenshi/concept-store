import { MerchantProfile } from '@/features/merchants/merchant-profile';

interface NewMerchantPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function NewMerchantPage({
  params,
}: NewMerchantPageProps) {
  const { organizationId } = await params;
  return <MerchantProfile organizationId={organizationId} />;
}
