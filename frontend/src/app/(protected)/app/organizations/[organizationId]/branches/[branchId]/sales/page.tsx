import { LegacySalesRoute } from '@/features/sales/components/legacy-sales-route';
export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const scope = await params;
  return <LegacySalesRoute {...scope} />;
}
