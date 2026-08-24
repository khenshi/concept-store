import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { MerchantProfile } from '@/features/merchants/merchant-profile';

interface NewMerchantPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function NewMerchantPage({
  params,
}: NewMerchantPageProps) {
  const { organizationId } = await params;
  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <MerchantProfile organizationId={organizationId} />
    </main>
  );
}
