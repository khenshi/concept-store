import type { OrganizationAccess } from './organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

export function OrganizationPageHeader({
  organization,
  title,
  description,
}: {
  organization: OrganizationAccess;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6 max-sm:grid">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          {organization.name}
        </p>
        <h1 className="text-[clamp(1.65rem,3vw,2rem)] leading-tight font-bold tracking-[-0.025em] text-slate-950">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
        {roleLabels[organization.role]}
      </span>
    </div>
  );
}
