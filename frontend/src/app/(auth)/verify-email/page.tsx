import { VerifyEmailPage } from '@/features/auth/components/account-action-pages';

export default async function VerifyEmailRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  return <VerifyEmailPage {...params} />;
}
