import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { MerchantProfile } from '@/features/merchants/merchant-profile';

interface MerchantPageProps {
  params: Promise<{ organizationId: string; merchantId: string }>;
}

export default async function MerchantPage({ params }: MerchantPageProps) {
  const { organizationId, merchantId } = await params;
  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <MerchantProfile
        organizationId={organizationId}
        merchantId={merchantId}
      />
    </main>
  );
}
