import Link from 'next/link';

export function OrganizationNavigation({
  organizationId,
  active,
  showMembers = false,
  showMerchants = false,
  showSpaces = false,
}: {
  organizationId: string;
  active: 'overview' | 'branches' | 'members' | 'merchants' | 'spaces';
  showMembers?: boolean;
  showMerchants?: boolean;
  showSpaces?: boolean;
}) {
  const basePath = `/app/organizations/${organizationId}`;

  return (
    <nav
      className="mt-7 flex gap-1 overflow-x-auto border-b border-slate-200"
      aria-label="Organization"
    >
      <Link
        className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
        aria-current={active === 'overview' ? 'page' : undefined}
        href={basePath}
      >
        Overview
      </Link>
      <Link
        className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
        aria-current={active === 'branches' ? 'page' : undefined}
        href={`${basePath}/branches`}
      >
        Branches
      </Link>
      {showSpaces ? (
        <Link
          className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
          aria-current={active === 'spaces' ? 'page' : undefined}
          href={`${basePath}/spaces`}
        >
          Spaces
        </Link>
      ) : null}
      {showMerchants ? (
        <Link
          className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
          aria-current={active === 'merchants' ? 'page' : undefined}
          href={`${basePath}/merchants`}
        >
          Merchants
        </Link>
      ) : null}
      {showMembers ? (
        <Link
          className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
          aria-current={active === 'members' ? 'page' : undefined}
          href={`${basePath}/members`}
        >
          Members
        </Link>
      ) : null}
    </nav>
  );
}
