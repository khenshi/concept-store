'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function OrganizationNavigation({
  organizationId,
  showMembers = false,
  collapsed = false,
  onNavigate,
}: {
  organizationId: string;
  showMembers?: boolean;
  collapsed?: boolean;
  onNavigate?(): void;
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
      key: 'members',
      label: 'Members',
      href: `${basePath}/members`,
      visible: showMembers,
    },
  ];

  return (
    <nav className="mt-4 grid gap-1" aria-label="Organization">
      {destinations.map((destination) =>
        destination.visible ? (
          <Link
            key={destination.key}
            className={`flex min-h-11 items-center rounded-[0.6rem] border-l-2 border-transparent text-sm font-semibold text-slate-500 no-underline transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-[current=page]:border-emerald-600 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'}`}
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
    </nav>
  );
}

function NavigationIcon({ destination }: { destination: string }) {
  const paths: Record<string, string> = {
    overview: 'M4 10.5 12 4l8 6.5V20H4v-9.5Z',
    branches: 'M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6',
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
