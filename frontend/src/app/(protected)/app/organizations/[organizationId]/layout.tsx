import type { ReactNode } from 'react';
import { OrganizationWorkspaceProvider } from '@/features/organizations/organization-workspace-context';

interface OrganizationLayoutProps {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  const { organizationId } = await params;
  return (
    <OrganizationWorkspaceProvider organizationId={organizationId}>
      {children}
    </OrganizationWorkspaceProvider>
  );
}
