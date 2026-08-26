import type { ReactNode } from 'react';
import { OrganizationWorkspaceProvider } from '@/features/organizations/organization-workspace-context';
import { OrganizationWorkspaceShell } from '@/features/organizations/organization-workspace-shell';

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
      <OrganizationWorkspaceShell organizationId={organizationId}>
        {children}
      </OrganizationWorkspaceShell>
    </OrganizationWorkspaceProvider>
  );
}
