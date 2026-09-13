import { BranchSales } from '@/features/sales/components/branch-sales';
export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const scope = await params;
  return <BranchSales {...scope} />;
}
