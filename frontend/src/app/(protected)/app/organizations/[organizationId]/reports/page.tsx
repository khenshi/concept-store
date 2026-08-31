import { ReportsWorkspace } from '@/features/reports/reports-workspace';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <ReportsWorkspace organizationId={organizationId} />;
}
