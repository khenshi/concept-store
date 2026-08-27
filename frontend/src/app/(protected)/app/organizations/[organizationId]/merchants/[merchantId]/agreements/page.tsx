import { redirect } from 'next/navigation';

interface MerchantAgreementsRouteProps {
  params: Promise<{ organizationId: string; merchantId: string }>;
}

export default async function MerchantAgreementsRoute({
  params,
}: MerchantAgreementsRouteProps) {
  const { organizationId, merchantId } = await params;
  redirect(
    `/app/organizations/${organizationId}/agreements?merchantId=${merchantId}`,
  );
}
