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
};

export function OrganizationNavigation({
  organizationId,
  showMembers = false,
  showMerchants = false,
  showProducts = false,
  showSales = false,
  showPos = false,
  collapsed = false,
  onNavigate,
}: {
  organizationId: string;
  showMembers?: boolean;
  showMerchants?: boolean;
  showProducts?: boolean;
  showSales?: boolean;
  showPos?: boolean;
  collapsed?: boolean;
  onNavigate?(): void;
}) {
  const pathname = usePathname();
  const basePath = `/app/organizations/${organizationId}`;
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
  const destinations = [
    { key: 'pos', label: 'POS', href: `${basePath}/pos`, visible: showPos },
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
      key: 'sales',
      label: 'Sales',
      href: `${basePath}/sales`,
      visible: showSales,
    },
    {
      key: 'members',
      label: 'Members',
      href: `${basePath}/members`,
      visible: showMembers,
    },
  ];

  return (
    <nav className="mt-4 grid gap-1" aria-label="Organization">
      {!collapsed ? (
        <p className="px-3 pb-2 text-xs font-medium text-muted">Workspace</p>
      ) : null}
      {destinations.map((destination) =>
        destination.visible ? (
          <Link
            key={destination.key}
            className={`flex min-h-11 items-center rounded-control border border-transparent text-sm font-medium text-muted no-underline transition-colors hover:bg-subtle hover:text-ink aria-[current=page]:border-selected-border aria-[current=page]:bg-selected aria-[current=page]:font-semibold aria-[current=page]:text-ink ${collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'}`}
            aria-current={
              destination.key === 'pos'
                ? posRoute
                  ? 'page'
                  : undefined
                : destination.key === 'sales'
                  ? ownSalesRoute
                    ? 'page'
                    : undefined
                  : destination.key === 'branches' &&
                      (ownSalesRoute || posRoute)
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
            <span className={collapsed ? 'sr-only' : ''}>
              {destination.label}
            </span>
          </Link>
        ) : null,
      )}
    </nav>
  );
}
