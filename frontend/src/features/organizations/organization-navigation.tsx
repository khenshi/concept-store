import Link from 'next/link';

export function OrganizationNavigation({
  organizationId,
  active,
  showMembers = false,
}: {
  organizationId: string;
  active: 'overview' | 'branches' | 'members';
  showMembers?: boolean;
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
      {showMembers ? (
        <Link
          aria-current={active === 'members' ? 'page' : undefined}
          href={`${basePath}/members`}
        >
          Members
        </Link>
      ) : null}
    </nav>
  );
}
