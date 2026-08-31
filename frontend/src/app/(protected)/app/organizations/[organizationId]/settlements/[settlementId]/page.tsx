import { SettlementDetailPage } from '@/features/finance/settlement-detail';

export default async function SettlementPage({
  params,
}: {
  params: Promise<{ organizationId: string; settlementId: string }>;
}) {
  const { organizationId, settlementId } = await params;
  return (
    <SettlementDetailPage
      organizationId={organizationId}
      settlementId={settlementId}
    />
  );
}
