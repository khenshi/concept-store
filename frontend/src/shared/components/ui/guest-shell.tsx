import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandWordmark } from '@/shared/components/branding/brand-wordmark';
import { Icon } from './icon';

export function GuestShell({
  children,
  eyebrow,
  title,
  description,
  contextTitle = 'Your business,\nworking together.',
  contextDescription = 'One workspace for your organization, branches, team access, and merchant identities.',
}: {
  children: ReactNode;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  contextTitle?: string;
  contextDescription?: string;
}) {
  return (
    <main className="min-h-dvh bg-canvas px-4 py-5 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-7xl flex-col sm:min-h-[calc(100dvh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandWordmark tone="neutral" />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm text-muted no-underline hover:text-ink"
          >
            <Icon name="arrow" className="size-4 rotate-180" />
            Back to home
          </Link>
        </header>
        <div className="grid flex-1 items-center gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <section
            aria-labelledby="guest-title"
            className="mx-auto w-full min-w-0 max-w-xl rounded-feature border border-hairline bg-surface p-5 sm:p-8 lg:p-10"
          >
            <p className="mb-4 text-xs font-medium text-muted">{eyebrow}</p>
            <h1
              id="guest-title"
              className="break-words text-[clamp(2rem,5vw,2.75rem)] leading-[1.08] font-medium tracking-[-0.045em]"
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-4 text-sm leading-6 text-muted">{description}</p>
            ) : null}
            <div className="mt-8 min-w-0">{children}</div>
          </section>
          <aside
            className="hidden min-w-0 py-12 lg:block"
            aria-label="Workspace context"
          >
            <p className="mb-6 text-xs font-medium text-muted">
              Concept-store workspaces
            </p>
            <h2 className="whitespace-pre-line text-[clamp(2.75rem,4.5vw,4.5rem)] leading-[1.03] font-medium tracking-[-0.055em]">
              {contextTitle}
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-muted">
              {contextDescription}
            </p>
            <div className="mt-10 flex flex-wrap gap-2 text-xs text-muted">
              {['Organizations', 'Branches', 'Teams', 'Merchants'].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-hairline px-3 py-2"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
