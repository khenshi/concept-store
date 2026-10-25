import { ResetPasswordPage } from '@/features/auth/components/account-action-pages';

export default async function ResetPasswordRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordPage token={params.token} />;
}
