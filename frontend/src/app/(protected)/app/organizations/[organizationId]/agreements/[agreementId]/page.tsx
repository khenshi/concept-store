import { AgreementDetailPage } from '@/features/merchants/agreements/agreement-detail-page';

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ organizationId: string; agreementId: string }>;
}) {
  const { organizationId, agreementId } = await params;
  return (
    <AgreementDetailPage
      organizationId={organizationId}
      agreementId={agreementId}
    />
  );
}
