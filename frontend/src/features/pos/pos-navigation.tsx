'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PosNavigation({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const basePath = `/app/organizations/${organizationId}/pos`;
  const links = [
    { label: 'New sale', href: basePath, exact: true },
    { label: 'Sales history', href: `${basePath}/sales`, exact: false },
  ];
  return (
    <nav
      className="mt-6 flex gap-1 border-b border-slate-200"
      aria-label="Point of sale"
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            className={`border-b-2 px-3 py-3 text-sm font-bold no-underline ${active ? 'border-emerald-600 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            aria-current={active ? 'page' : undefined}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
