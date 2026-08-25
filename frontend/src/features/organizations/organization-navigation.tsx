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
  const destinations = [
    { key: 'overview', label: 'Overview', href: basePath, visible: true },
    {
      key: 'branches',
      label: 'Branches',
      href: `${basePath}/branches`,
      visible: true,
    },
    {
      key: 'spaces',
      label: 'Spaces',
      href: `${basePath}/spaces`,
      visible: showSpaces,
    },
    {
      key: 'merchants',
      label: 'Merchants',
      href: `${basePath}/merchants`,
      visible: showMerchants,
    },
    {
      key: 'members',
      label: 'Members',
      href: `${basePath}/members`,
      visible: showMembers,
    },
  ] as const;

  return (
    <nav
      className="mt-7 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-200"
      aria-label="Organization"
    >
      {destinations.map((destination) =>
        destination.visible ? (
          <Link
            key={destination.key}
            className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950"
            aria-current={active === destination.key ? 'page' : undefined}
            href={destination.href}
          >
            {destination.label}
          </Link>
        ) : null,
      )}
    </nav>
  );
}
