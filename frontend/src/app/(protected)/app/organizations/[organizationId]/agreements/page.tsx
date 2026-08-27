import { OrganizationAgreementsPage } from '@/features/merchants/agreements/organization-agreements-page';

export default async function AgreementsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationAgreementsPage organizationId={organizationId} />;
}
