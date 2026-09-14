import { ReportsEntry } from '@/features/reports/components/reports-entry';
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <ReportsEntry organizationId={organizationId} />;
}
