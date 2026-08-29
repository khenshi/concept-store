'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function OrganizationNavigation({
  organizationId,
  showMembers = false,
  showMerchants = false,
  showProducts = false,
  showInventory = false,
  showPos = false,
  showSpaces = false,
  onNavigate,
}: {
  organizationId: string;
  showMembers?: boolean;
  showMerchants?: boolean;
  showProducts?: boolean;
  showInventory?: boolean;
  showPos?: boolean;
  showSpaces?: boolean;
  onNavigate?(): void;
}) {
  const pathname = usePathname();
  const basePath = `/app/organizations/${organizationId}`;
  const groups = [
    {
      label: null,
      destinations: [
        { key: 'overview', label: 'Overview', href: basePath, visible: true },
      ],
    },
    {
      label: 'Operations',
      destinations: [
        {
          key: 'pos',
          label: 'Point of sale',
          href: `${basePath}/pos`,
          visible: showPos,
        },
        {
          key: 'products',
          label: 'Products',
          href: `${basePath}/products`,
          visible: showProducts,
        },
        {
          key: 'inventory',
          label: 'Inventory',
          href: `${basePath}/inventory`,
          visible: showInventory,
        },
      ],
    },
    {
      label: 'Business',
      destinations: [
        {
          key: 'merchants',
          label: 'Merchants',
          href: `${basePath}/merchants`,
          visible: showMerchants,
        },
        {
          key: 'agreements',
          label: 'Agreements',
          href: `${basePath}/agreements`,
          visible: showMerchants,
        },
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
          key: 'members',
          label: 'Members',
          href: `${basePath}/members`,
          visible: showMembers,
        },
      ],
    },
  ] as const;

  return (
    <nav className="mt-4 grid gap-5" aria-label="Organization">
      {groups.map((group, index) => (
        <div className="grid gap-1" key={group.label ?? index}>
          {group.label ? (
            <p className="px-3 pt-2 text-[0.68rem] font-bold tracking-[0.14em] text-slate-400 uppercase">
              {group.label}
            </p>
          ) : null}
          {group.destinations.map((destination) =>
            destination.visible ? (
              <Link
                key={destination.key}
                className="rounded-[0.6rem] border-l-2 border-transparent px-3 py-2.5 text-sm font-semibold text-slate-500 no-underline transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-[current=page]:border-emerald-600 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800"
                aria-current={
                  destination.key === 'overview'
                    ? pathname === basePath
                      ? 'page'
                      : undefined
                    : destination.key === 'merchants'
                      ? pathname === destination.href
                        ? 'page'
                        : undefined
                      : pathname.startsWith(destination.href)
                        ? 'page'
                        : undefined
                }
                href={destination.href}
                onClick={onNavigate}
              >
                {destination.label}
              </Link>
            ) : null,
          )}
        </div>
      ))}
    </nav>
  );
}
