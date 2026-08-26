'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function OrganizationNavigation({
  organizationId,
  showMembers = false,
  showMerchants = false,
  showSpaces = false,
  showProducts = false,
  showInventory = false,
}: {
  organizationId: string;
  showMembers?: boolean;
  showMerchants?: boolean;
  showSpaces?: boolean;
  showProducts?: boolean;
  showInventory?: boolean;
}) {
  const pathname = usePathname();
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
    {
      key: 'members',
      label: 'Members',
      href: `${basePath}/members`,
      visible: showMembers,
    },
  ] as const;

  return (
    <nav
      className="mt-5 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-200 lg:grid lg:gap-1 lg:overflow-visible lg:border-b-0"
      aria-label="Organization"
    >
      {destinations.map((destination) =>
        destination.visible ? (
          <Link
            key={destination.key}
            className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900 aria-[current=page]:border-emerald-600 aria-[current=page]:text-slate-950 lg:rounded-[0.6rem] lg:border-b-0 lg:border-l-2 lg:py-2.5 lg:aria-[current=page]:bg-white"
            aria-current={
              destination.key === 'overview'
                ? pathname === basePath
                  ? 'page'
                  : undefined
                : pathname.startsWith(destination.href)
                  ? 'page'
                  : undefined
            }
            href={destination.href}
          >
            {destination.label}
          </Link>
        ) : null,
      )}
    </nav>
  );
}
