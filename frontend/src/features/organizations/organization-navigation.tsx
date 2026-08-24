import Link from 'next/link';

export function OrganizationNavigation({
  organizationId,
  active,
}: {
  organizationId: string;
  active: 'overview' | 'branches';
}) {
  const basePath = `/app/organizations/${organizationId}`;

  return (
    <nav className="organization-nav" aria-label="Organization">
      <Link
        aria-current={active === 'overview' ? 'page' : undefined}
        href={basePath}
      >
        Overview
      </Link>
      <Link
        aria-current={active === 'branches' ? 'page' : undefined}
        href={`${basePath}/branches`}
      >
        Branches
      </Link>
    </nav>
  );
}
