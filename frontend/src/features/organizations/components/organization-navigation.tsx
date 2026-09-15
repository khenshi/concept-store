'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/shared/components/ui/icon';

const navigationIcons: Record<string, IconName> = {
  overview: 'home',
  branches: 'building',
  merchants: 'store',
  products: 'store',
  members: 'users',
  sales: 'store',
  pos: 'store',
  inventory: 'store',
  reports: 'store',
};

export function OrganizationNavigation({
  organizationId,
  showMembers = false,
  showMerchants = false,
  showProducts = false,
  showSales = false,
  showPos = false,
  showInventory = false,
  showReports = false,
  collapsed = false,
  onNavigate,
}: {
  organizationId: string;
  showMembers?: boolean;
  showMerchants?: boolean;
  showProducts?: boolean;
  showSales?: boolean;
  showPos?: boolean;
  showInventory?: boolean;
  showReports?: boolean;
  collapsed?: boolean;
  onNavigate?(): void;
}) {
  const pathname = usePathname();
  const basePath = `/app/organizations/${organizationId}`;
  const reportsRoute =
    showReports &&
    (pathname === `${basePath}/reports` ||
      pathname.startsWith(`${basePath}/reports/`) ||
      (pathname.startsWith(`${basePath}/branches/`) &&
        pathname.slice(`${basePath}/branches/`.length).split('/')[1] ===
          'reports'));
  const inventoryRoute =
    showInventory &&
    (pathname === `${basePath}/inventory` ||
      pathname.startsWith(`${basePath}/inventory/`) ||
      (pathname.startsWith(`${basePath}/branches/`) &&
        pathname.slice(`${basePath}/branches/`.length).split('/')[1] ===
          'inventory'));
  const posRoute =
    showPos &&
    (pathname === `${basePath}/pos` ||
      pathname.startsWith(`${basePath}/pos/`) ||
      (pathname.startsWith(`${basePath}/branches/`) &&
        pathname.slice(`${basePath}/branches/`.length).split('/')[1] ===
          'pos'));
  const ownSalesRoute =
    showSales &&
    (pathname === `${basePath}/sales` ||
      pathname.startsWith(`${basePath}/sales/`) ||
      (pathname.startsWith(`${basePath}/branches/`) &&
        pathname.slice(`${basePath}/branches/`.length).split('/')[1] ===
          'sales'));
  const branchDestinations = [
    {
      key: 'reports',
      label: 'Reports',
      href: `${basePath}/reports`,
      visible: showReports,
    },
    {
      key: 'inventory',
      label: 'Inventory',
      href: `${basePath}/inventory`,
      visible: showInventory,
    },
    { key: 'pos', label: 'POS', href: `${basePath}/pos`, visible: showPos },
  ];
  const organizationDestinations = [
    { key: 'overview', label: 'Overview', href: basePath, visible: true },
    {
      key: 'branches',
      label: 'Branches',
      href: `${basePath}/branches`,
      visible: true,
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
      key: 'members',
      label: 'Members',
      href: `${basePath}/members`,
      visible: showMembers,
    },
  ];

  branchDestinations.push({
    key: 'sales',
    label: 'Sales',
    href: `${basePath}/sales`,
    visible: showSales,
  });
  const renderDestination = (
    destination: (typeof branchDestinations)[number],
  ) =>
    destination.visible ? (
      <Link
        key={destination.key}
        className={`flex min-h-11 items-center rounded-control border border-transparent text-sm font-medium text-muted no-underline transition-colors hover:bg-subtle hover:text-ink aria-[current=page]:border-selected-border aria-[current=page]:bg-selected aria-[current=page]:font-semibold aria-[current=page]:text-ink ${collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'}`}
        aria-current={
          destination.key === 'reports'
            ? reportsRoute
              ? 'page'
              : undefined
            : destination.key === 'inventory'
              ? inventoryRoute
                ? 'page'
                : undefined
              : destination.key === 'pos'
                ? posRoute
                  ? 'page'
                  : undefined
                : destination.key === 'sales'
                  ? ownSalesRoute
                    ? 'page'
                    : undefined
                  : destination.key === 'branches' &&
                      (ownSalesRoute ||
                        posRoute ||
                        inventoryRoute ||
                        reportsRoute)
                    ? undefined
                    : destination.key === 'overview'
                      ? pathname === basePath
                        ? 'page'
                        : undefined
                      : pathname === destination.href ||
                          pathname.startsWith(`${destination.href}/`)
                        ? 'page'
                        : undefined
        }
        href={destination.href}
        onClick={onNavigate}
        title={collapsed ? destination.label : undefined}
      >
        <Icon name={navigationIcons[destination.key]} />
        <span className={collapsed ? 'sr-only' : ''}>{destination.label}</span>
      </Link>
    ) : null;
  return (
    <nav className="mt-4 grid gap-5" aria-label="Organization workspace">
      <section aria-labelledby="branch-operations-navigation">
        <h2
          id="branch-operations-navigation"
          className={
            collapsed ? 'sr-only' : 'px-3 pb-2 text-xs font-medium text-muted'
          }
        >
          Branch operations
        </h2>
        <div className="grid gap-1">
          {branchDestinations.map(renderDestination)}
        </div>
      </section>
      <section aria-labelledby="organization-navigation">
        <h2
          id="organization-navigation"
          className={
            collapsed ? 'sr-only' : 'px-3 pb-2 text-xs font-medium text-muted'
          }
        >
          Organization
        </h2>
        <div className="grid gap-1">
          {organizationDestinations.map(renderDestination)}
        </div>
      </section>
    </nav>
  );
}
