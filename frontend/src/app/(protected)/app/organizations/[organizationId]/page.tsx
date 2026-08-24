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
    <main className="min-h-screen px-[clamp(1.25rem,5vw,4rem)] py-5">
      <AuthenticatedHeader />
      <OrganizationWorkspace organizationId={organizationId} />
    </main>
  );
}
