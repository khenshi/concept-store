import { MerchantDirectory } from '@/features/merchants/merchant-directory';

interface MerchantsPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function MerchantsPage({ params }: MerchantsPageProps) {
  const { organizationId } = await params;
  return <MerchantDirectory organizationId={organizationId} />;
}
