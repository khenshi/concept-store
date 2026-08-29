import { PosWorkspace } from '@/features/pos/pos-workspace';

export default async function PosPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <PosWorkspace organizationId={organizationId} />;
}
