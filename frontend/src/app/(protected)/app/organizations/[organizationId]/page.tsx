import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { OrganizationWorkspace } from '@/features/organizations/organization-workspace';

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { organizationId } = await params;

  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <OrganizationWorkspace organizationId={organizationId} />
    </main>
  );
}
