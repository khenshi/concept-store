import { redirect } from 'next/navigation';

interface NewMerchantPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function NewMerchantPage({
  params,
}: NewMerchantPageProps) {
  const { organizationId } = await params;
  redirect(`/app/organizations/${organizationId}/merchants`);
}
