import { Suspense, type ReactNode } from 'react';
import { BranchReports } from '@/features/reports/components/branch-reports';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';

export default async function ReportsLayout({
  params,
  children,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
  children: ReactNode;
}) {
  const scope = await params;
  return (
    <Suspense fallback={<ListSkeleton label="Loading Reports workspace" />}>
      <BranchReports {...scope}>{children}</BranchReports>
    </Suspense>
  );
}
