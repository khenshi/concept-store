import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { OrganizationEntry } from '@/features/organizations/organization-entry';

export default function AppPage() {
  return (
    <main className="app-shell">
      <AuthenticatedHeader />
      <OrganizationEntry />
    </main>
  );
}
