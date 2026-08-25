import { OrganizationNavigation } from './organization-navigation';
import type { OrganizationAccess } from './organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

export function OrganizationPageHeader({
  organization,
  organizationId,
  active,
  title,
  description,
}: {
  organization: OrganizationAccess;
  organizationId: string;
  active: 'overview' | 'branches' | 'members' | 'merchants' | 'spaces';
  title: string;
  description: string;
}) {
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <>
      <div className="flex items-start justify-between gap-6 max-sm:grid">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
            {organization.name}
          </p>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.04em] text-slate-950">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-500">
            {description}
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
          {roleLabels[organization.role]}
        </span>
      </div>
      <OrganizationNavigation
        organizationId={organizationId}
        active={active}
        showMembers={canManage}
        showMerchants={canManage}
        showSpaces={canManage}
      />
    </>
  );
}
