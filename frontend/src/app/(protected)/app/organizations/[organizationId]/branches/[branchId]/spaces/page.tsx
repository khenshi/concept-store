import { SpacesWorkspace } from '@/features/spaces/components/spaces-workspace';
export default async function SpacesPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const scope = await params;
  return <SpacesWorkspace {...scope} />;
}
