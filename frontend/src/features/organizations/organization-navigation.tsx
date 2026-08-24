import Link from 'next/link';

export function OrganizationNavigation({
  organizationId,
  active,
  showMembers = false,
  showMerchants = false,
}: {
  organizationId: string;
  active: 'overview' | 'branches' | 'members' | 'merchants';
  showMembers?: boolean;
  showMerchants?: boolean;
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
      {showMerchants ? (
        <Link
          aria-current={active === 'merchants' ? 'page' : undefined}
          href={`${basePath}/merchants`}
        >
          Merchants
        </Link>
      ) : null}
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
