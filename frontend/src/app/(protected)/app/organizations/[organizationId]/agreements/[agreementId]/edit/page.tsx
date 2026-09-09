import { AgreementFormPage } from '@/features/merchants/agreements/agreement-form-page';

export default async function EditAgreementPage({
  params,
}: {
  params: Promise<{ organizationId: string; agreementId: string }>;
}) {
  const { organizationId, agreementId } = await params;
  return (
    <AgreementFormPage
      organizationId={organizationId}
      agreementId={agreementId}
    />
  );
}
