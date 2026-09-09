import { AgreementFormPage } from '@/features/merchants/agreements/agreement-form-page';

export default async function NewAgreementPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <AgreementFormPage organizationId={organizationId} />;
}
