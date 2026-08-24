import Link from 'next/link';

export function OrganizationNavigation({
  organizationId,
  active,
  showMembers = false,
  showMerchants = false,
}: {
  organizationId: string;
  active: 'overview' | 'branches' | 'members' | 'merchants';
  showMembers?: boolean;
  showMerchants?: boolean;
}) {
  const basePath = `/app/organizations/${organizationId}`;

  return (
    <nav
      className="mt-7 flex gap-6 border-b border-slate-200"
      aria-label="Organization"
    >
      <Link
        className="border-b-2 border-transparent pb-3 text-sm font-bold text-slate-500 no-underline aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-900"
        aria-current={active === 'overview' ? 'page' : undefined}
        href={basePath}
      >
        Overview
      </Link>
      <Link
        className="border-b-2 border-transparent pb-3 text-sm font-bold text-slate-500 no-underline aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-900"
        aria-current={active === 'branches' ? 'page' : undefined}
        href={`${basePath}/branches`}
      >
        Branches
      </Link>
      {showMerchants ? (
        <Link
          className="border-b-2 border-transparent pb-3 text-sm font-bold text-slate-500 no-underline aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-900"
          aria-current={active === 'merchants' ? 'page' : undefined}
          href={`${basePath}/merchants`}
        >
          Merchants
        </Link>
      ) : null}
      {showMembers ? (
        <Link
          className="border-b-2 border-transparent pb-3 text-sm font-bold text-slate-500 no-underline aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-900"
          aria-current={active === 'members' ? 'page' : undefined}
          href={`${basePath}/members`}
        >
          Members
        </Link>
      ) : null}
    </nav>
  );
}
