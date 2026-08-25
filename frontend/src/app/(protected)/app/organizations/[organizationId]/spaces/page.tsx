import { SpaceManagement } from '@/features/spaces/space-management';

interface SpacesPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function SpacesPage({ params }: SpacesPageProps) {
  const { organizationId } = await params;
  return <SpaceManagement organizationId={organizationId} />;
}
