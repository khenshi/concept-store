import { BranchReports } from '@/features/reports/components/branch-reports';
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  return <BranchReports organizationId={organizationId} branchId={branchId} />;
}
