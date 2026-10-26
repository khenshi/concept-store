import { PaymentAccountManagement } from '@/features/payment-accounts/components/payment-account-management';

export default async function PaymentAccountsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <PaymentAccountManagement organizationId={organizationId} />;
}
