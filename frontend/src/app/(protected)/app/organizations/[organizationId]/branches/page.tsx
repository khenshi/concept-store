import { BranchManagement } from '@/features/branches/branch-management';

interface BranchesPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { organizationId } = await params;

  return <BranchManagement organizationId={organizationId} />;
}
