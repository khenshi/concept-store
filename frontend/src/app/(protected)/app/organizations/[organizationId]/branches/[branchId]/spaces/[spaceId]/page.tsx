import { SpaceDetail } from '@/features/spaces/components/space-detail';

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
    spaceId: string;
  }>;
}) {
  const { organizationId, branchId, spaceId } = await params;
  return (
    <SpaceDetail
      organizationId={organizationId}
      branchId={branchId}
      spaceId={spaceId}
    />
  );
}
