import { MerchantDirectory } from '@/features/merchants/components/merchant-directory';

export default async function MerchantsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <MerchantDirectory organizationId={organizationId} />;
}
