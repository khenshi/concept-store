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
    <main className="min-h-screen px-[clamp(1.25rem,5vw,4rem)] py-5">
      <AuthenticatedHeader />
      <MerchantProfile organizationId={organizationId} />
    </main>
  );
}
