import type { OrganizationAccess } from './organization.types';

export function OrganizationPageHeader({
  title,
  description,
}: {
  organization: OrganizationAccess;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-200 pb-4">
      <h1 className="text-[clamp(1.5rem,2.5vw,1.75rem)] leading-tight font-bold tracking-[-0.025em] text-slate-950">
        {title}
      </h1>
      <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}
