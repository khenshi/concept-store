import { Suspense, type ReactNode } from 'react';
import { BranchReports } from '@/features/reports/components/branch-reports';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';

export default async function AllReportsLayout({
  params,
  children,
}: {
  params: Promise<{ organizationId: string }>;
  children: ReactNode;
}) {
  const { organizationId } = await params;
  return (
    <Suspense fallback={<ListSkeleton label="Loading Reports workspace" />}>
      <BranchReports organizationId={organizationId} scope={{ kind: 'all' }}>
        {children}
      </BranchReports>
    </Suspense>
  );
}
