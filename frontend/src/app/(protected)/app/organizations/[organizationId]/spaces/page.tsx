import { SpaceManagement } from '@/features/spaces/space-management';

interface SpacesPageProps {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ branchId?: string }>;
}

export default async function SpacesPage({
  params,
  searchParams,
}: SpacesPageProps) {
  const { organizationId } = await params;
  const { branchId } = await searchParams;
  return (
    <SpaceManagement
      organizationId={organizationId}
      initialBranchId={branchId}
    />
  );
}
