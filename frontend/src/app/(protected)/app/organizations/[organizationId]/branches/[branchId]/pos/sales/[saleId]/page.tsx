import { SaleDetail } from '@/features/sales/components/sale-detail';
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
    <SaleDetail
      {...scope}
      embedded
      returnTo={
        typeof query?.returnTo === 'string' ? query.returnTo : undefined
      }
    />
  );
}
