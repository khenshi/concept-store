import { LivePayableDetailPage } from '@/features/finance/live-payable-detail';

export default async function LivePayablePage({
  params,
}: {
  params: Promise<{ organizationId: string; merchantId: string }>;
}) {
  const { organizationId, merchantId } = await params;
  return (
    <LivePayableDetailPage
      organizationId={organizationId}
      merchantId={merchantId}
    />
  );
}
