import { Suspense } from 'react';
import { BranchRefunds } from '@/features/refunds/components/branch-refunds';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const scope = await params;
  return (
    <Suspense fallback={<ListSkeleton label="Loading refund history" />}>
      <BranchRefunds {...scope} />
    </Suspense>
  );
}
