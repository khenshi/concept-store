import { BranchPos } from '@/features/pos/components/branch-pos';

export default async function PosPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  return <BranchPos organizationId={organizationId} branchId={branchId} />;
}
