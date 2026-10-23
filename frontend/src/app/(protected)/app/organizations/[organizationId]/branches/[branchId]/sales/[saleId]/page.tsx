import { LegacySalesRoute } from '@/features/sales/components/legacy-sales-route';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; branchId: string; saleId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  const query = await searchParams;
  return (
    <LegacySalesRoute
      {...scope}
      returnTo={
        typeof query?.returnTo === 'string' ? query.returnTo : undefined
      }
    />
  );
}
