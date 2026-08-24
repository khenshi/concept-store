import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { BranchManagement } from '@/features/branches/branch-management';

interface BranchesPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { organizationId } = await params;

  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <BranchManagement organizationId={organizationId} />
    </main>
  );
}
