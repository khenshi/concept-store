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
  showFinance = false,
  collapsed = false,
  onNavigate,
}: {
  organizationId: string;
  showMembers?: boolean;
  showMerchants?: boolean;
  showProducts?: boolean;
  showInventory?: boolean;
  showPos?: boolean;
  showSpaces?: boolean;
  showFinance?: boolean;
  collapsed?: boolean;
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
          key: 'settlements',
          label: 'Merchant finance',
          href: `${basePath}/settlements`,
          visible: showFinance,
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
    <nav
      className={`mt-4 grid ${collapsed ? 'gap-2' : 'gap-5'}`}
      aria-label="Organization"
    >
      {groups.map((group, index) => (
        <div className="grid gap-1" key={group.label ?? index}>
          {group.label ? (
            collapsed ? (
              <hr className="my-2 w-full border-0 border-t border-slate-200" />
            ) : (
              <p className="px-3 pt-2 text-[0.68rem] font-bold tracking-[0.14em] text-slate-400 uppercase">
                {group.label}
              </p>
            )
          ) : null}
          {group.destinations.map((destination) =>
            destination.visible ? (
              <Link
                key={destination.key}
                className={`flex min-h-11 items-center rounded-[0.6rem] border-l-2 border-transparent text-sm font-semibold text-slate-500 no-underline transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-[current=page]:border-emerald-600 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'}`}
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
                title={collapsed ? destination.label : undefined}
              >
                <NavigationIcon destination={destination.key} />
                <span className={collapsed ? 'sr-only' : ''}>
                  {destination.label}
                </span>
              </Link>
            ) : null,
          )}
        </div>
      ))}
    </nav>
  );
}

function NavigationIcon({ destination }: { destination: string }) {
  const paths: Record<string, string> = {
    overview: 'M4 10.5 12 4l8 6.5V20H4v-9.5Z',
    pos: 'M4 5h16v14H4zM8 9h8M8 13h3',
    products: 'M5 7h14l-1 13H6L5 7Zm3 0a4 4 0 0 1 8 0',
    inventory: 'm4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8',
    reports: 'M5 20V10m7 10V4m7 16v-7',
    merchants:
      'M4 20v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    agreements: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6M15 3v4h4',
    settlements: 'M4 7h16v12H4zM4 10h16M8 15h3',
    branches: 'M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6',
    spaces: 'M4 5h16v14H4zM4 10h16M10 10v9',
    members:
      'M3 20a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a4 4 0 0 1 5 4v3',
  };
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={paths[destination] ?? paths.overview}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
