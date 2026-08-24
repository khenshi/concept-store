import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import { OrganizationEntry } from '@/features/organizations/organization-entry';

export default function AppPage() {
  return (
    <main className="min-h-screen px-[clamp(1.25rem,5vw,4rem)] py-5">
      <AuthenticatedHeader />
      <OrganizationEntry />
    </main>
  );
}
