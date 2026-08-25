import { OrganizationMemberManagement } from '@/features/organization-members/organization-member-management';

interface MembersPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { organizationId } = await params;

  return <OrganizationMemberManagement organizationId={organizationId} />;
}
