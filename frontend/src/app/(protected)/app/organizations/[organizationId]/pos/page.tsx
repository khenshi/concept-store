import { PosEntry } from '@/features/pos/components/pos-entry';

export default async function PosPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <PosEntry organizationId={organizationId} />;
}
