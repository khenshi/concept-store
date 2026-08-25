import { OrganizationWorkspace } from '@/features/organizations/organization-workspace';

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { organizationId } = await params;

  return <OrganizationWorkspace organizationId={organizationId} />;
}
