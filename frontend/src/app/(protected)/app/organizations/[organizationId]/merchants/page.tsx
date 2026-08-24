import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { MerchantDirectory } from '@/features/merchants/merchant-directory';

interface MerchantsPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function MerchantsPage({ params }: MerchantsPageProps) {
  const { organizationId } = await params;
  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <MerchantDirectory organizationId={organizationId} />
    </main>
  );
}
