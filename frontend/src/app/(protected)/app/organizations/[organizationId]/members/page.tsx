import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { OrganizationMemberManagement } from '@/features/organization-members/organization-member-management';

interface MembersPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { organizationId } = await params;

  return (
    <main className="min-h-screen px-[clamp(1.25rem,5vw,4rem)] py-5">
      <AuthenticatedHeader />
      <OrganizationMemberManagement organizationId={organizationId} />
    </main>
  );
}
