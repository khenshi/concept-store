import { InvitationAcceptancePage } from '@/features/organization-invitations/components/invitation-acceptance-page';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationAcceptancePage token={token} />;
}
