import { BranchDetail } from '@/features/branches/branch-detail';

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  return <BranchDetail organizationId={organizationId} branchId={branchId} />;
}
