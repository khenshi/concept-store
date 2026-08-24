import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { MerchantDirectory } from '@/features/merchants/merchant-directory';

interface MerchantsPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function MerchantsPage({ params }: MerchantsPageProps) {
  const { organizationId } = await params;
  return (
    <main className="min-h-screen px-[clamp(1.25rem,5vw,4rem)] py-5">
      <AuthenticatedHeader />
      <MerchantDirectory organizationId={organizationId} />
    </main>
  );
}
