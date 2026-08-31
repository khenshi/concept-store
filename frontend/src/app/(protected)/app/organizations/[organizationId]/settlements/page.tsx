import { SettlementList } from '@/features/finance/settlement-list';

export default async function SettlementsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <SettlementList organizationId={organizationId} />;
}
