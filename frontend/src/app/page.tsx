import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Icon } from '@/shared/components/ui/icon';
import { buttonStyles } from '@/shared/components/ui/button';
import { BrandWordmark } from '@/shared/components/branding/brand-wordmark';

export const metadata: Metadata = {
  title: 'Kapwesto | A Clearer Workspace for Concept Stores',
  description:
    'Organize branches, team access, and merchant profiles in one secure workspace built for concept stores.',
};

const features = [
  {
    eyebrow: 'Branches',
    title: 'Keep every location in view',
    copy: 'Maintain the identity and address of each branch from one organized workspace.',
    preview: <BranchPreview />,
  },
  {
    eyebrow: 'People and merchants',
    title: 'Give every person the right context',
    copy: 'Invite teammates, assign clear roles, and keep merchant profiles easy to find.',
    preview: <PeoplePreview />,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink selection:bg-border-strong">
      <header className="px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-6">
          <BrandWordmark />
          <nav
            className="hidden items-center gap-8 text-sm text-muted md:flex"
            aria-label="Main navigation"
          >
            <a className="hover:text-ink" href="#features">
              Features
            </a>
            <a className="hover:text-ink" href="#how-it-works">
              How it works
            </a>
          </nav>
          <Link
            className={buttonStyles({ variant: 'secondary' })}
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:px-12 lg:pt-24 lg:pb-32">
        <div className="mx-auto grid max-w-[80rem] items-center gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="max-w-2xl">
            <p className="mb-6 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              The workspace for concept stores
            </p>
            <h1 className="text-[clamp(3.2rem,7vw,6.75rem)] leading-[0.91] font-medium tracking-[-0.07em] text-balance">
              Run your store with everything in its place.
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Bring organizations, branches, team access, and merchant profiles
              into one calm, secure workspace built for everyday operations.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link className={buttonStyles()} href="/register">
                Create your workspace
              </Link>
              <a
                className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-action underline decoration-selected-border underline-offset-4 hover:decoration-action focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href="#features"
              >
                Explore the workspace <Icon name="arrow" className="size-4" />
              </a>
            </div>
          </div>
          <WorkspacePreview />
        </div>
      </section>

      <section
        className="border-y border-hairline bg-surface px-5 py-24 sm:px-8 lg:px-12 lg:py-36"
        id="features"
      >
        <div className="mx-auto max-w-[80rem]">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto mb-5 w-fit rounded-full border border-hairline bg-subtle px-3 py-1 text-xs font-medium text-muted">
              A clearer foundation
            </p>
            <h2 className="text-[clamp(2.5rem,5vw,4.75rem)] leading-[0.98] font-medium tracking-[-0.06em] text-balance">
              Your business, organized around the way you work.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted">
              Keep the essentials connected without burying daily tasks beneath
              unnecessary tools.
            </p>
          </div>
          <div className="mt-20 grid gap-6 lg:mt-28 lg:gap-8" id="how-it-works">
            {features.map((feature, index) => (
              <article
                className="grid min-h-[30rem] overflow-hidden rounded-feature border border-hairline bg-subtle lg:grid-cols-2"
                key={feature.title}
              >
                <div
                  className={`flex flex-col justify-center p-8 sm:p-12 lg:p-16 ${index % 2 ? 'lg:order-2' : ''}`}
                >
                  <p className="mb-5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                    {feature.eyebrow}
                  </p>
                  <h3 className="max-w-lg text-3xl leading-[1.04] font-medium tracking-[-0.045em] sm:text-4xl">
                    {feature.title}
                  </h3>
                  <p className="mt-5 max-w-md leading-7 text-muted">
                    {feature.copy}
                  </p>
                  <Link
                    className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-action underline decoration-selected-border underline-offset-4 hover:decoration-action focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href="/register"
                  >
                    Start with Kapwesto <Icon name="arrow" className="size-4" />
                  </Link>
                </div>
                <div
                  className={`flex items-center justify-center border-hairline bg-surface p-6 sm:p-10 lg:border-l ${index % 2 ? 'lg:order-1 lg:border-r lg:border-l-0' : ''}`}
                >
                  {feature.preview}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
        <div className="mx-auto grid max-w-[80rem] gap-10 rounded-feature bg-action px-7 py-12 text-surface sm:px-12 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-end lg:px-16 lg:py-20">
          <div>
            <p className="mb-5 text-xs font-semibold tracking-[0.08em] text-surface/75 uppercase">
              Begin with the essentials
            </p>
            <h2 className="max-w-4xl text-[clamp(2.4rem,5vw,4.75rem)] leading-[0.98] font-medium tracking-[-0.055em] text-balance">
              A calmer way to manage the people and places behind your store.
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-action no-underline transition-colors hover:bg-selected focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-surface"
            href="/register"
          >
            Create your workspace
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[80rem] flex-col gap-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <BrandWordmark className="text-ink" />
          <p>Secure workspaces for modern concept stores.</p>
        </div>
      </footer>
    </main>
  );
}

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl" aria-hidden="true">
      <div className="absolute -inset-8 rounded-full bg-hairline/65 blur-3xl" />
      <div className="relative overflow-hidden rounded-feature border border-border-strong bg-surface shadow-[0_24px_70px_rgb(23_23_23/0.12)]">
        <div className="flex h-11 items-center gap-2 border-b border-hairline px-4">
          <i className="size-2 rounded-full bg-border-strong" />
          <i className="size-2 rounded-full bg-border-strong" />
          <i className="size-2 rounded-full bg-border-strong" />
          <i className="ml-auto h-5 w-28 rounded-md bg-canvas" />
        </div>
        <div className="grid min-h-[25rem] grid-cols-[4.5rem_1fr] sm:grid-cols-[10rem_1fr]">
          <div className="border-r border-hairline p-3 sm:p-4">
            <div className="mb-7 flex items-center gap-2 px-1">
              <span className="grid size-7 place-items-center rounded-lg bg-action text-[0.55rem] font-bold text-surface">
                K
              </span>
              <span className="hidden text-xs font-semibold sm:block">
                Kapwesto
              </span>
            </div>
            {['Overview', 'Branches', 'Merchants', 'Members'].map(
              (item, index) => (
                <div
                  className={`mb-1 flex h-9 items-center rounded-lg px-2 text-[0.65rem] ${index === 0 ? 'bg-selected font-semibold text-action' : 'text-faint'}`}
                  key={item}
                >
                  <span className="mx-auto size-3 rounded-sm border border-current sm:mx-0 sm:mr-2" />
                  <span className="hidden sm:block">{item}</span>
                </div>
              ),
            )}
          </div>
          <div className="min-w-0 bg-subtle p-4 sm:p-6">
            <p className="text-[0.6rem] text-faint">Your organization</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-base font-semibold tracking-[-0.03em] sm:text-lg">
                A clear place to begin
              </p>
              <span className="hidden rounded-lg bg-action px-3 py-2 text-[0.6rem] font-semibold text-surface sm:block">
                Add branch
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['Locations', '3'],
                ['Team members', '8'],
                ['Merchants', '24'],
              ].map(([label, value]) => (
                <div
                  className="rounded-xl border border-hairline bg-surface p-3"
                  key={label}
                >
                  <p className="text-[0.55rem] text-faint">{label}</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-hairline bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Recent branches</p>
                <span className="text-[0.55rem] text-faint">View all</span>
              </div>
              <div className="mt-3 divide-y divide-hairline">
                {['Main store', 'North branch', 'Weekend space'].map(
                  (branch, index) => (
                    <div className="flex items-center gap-3 py-3" key={branch}>
                      <span className="grid size-7 place-items-center rounded-lg bg-canvas text-[0.55rem] font-semibold">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold">{branch}</p>
                        <p className="mt-0.5 text-[0.5rem] text-faint">
                          Philippines
                        </p>
                      </div>
                      <Icon
                        name="chevron"
                        className="ml-auto size-4 -rotate-90 text-selected-border"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchPreview() {
  return (
    <PreviewFrame action="Add branch" title="Branches">
      {['Main store', 'North branch', 'Weekend space'].map((name, index) => (
        <PreviewRow
          badge={String(index + 1).padStart(2, '0')}
          detail="Store location · Philippines"
          key={name}
          name={name}
        />
      ))}
    </PreviewFrame>
  );
}

function PeoplePreview() {
  return (
    <PreviewFrame action="Invite member" title="People and merchants">
      {[
        ['AM', 'Ari Mendoza', 'Owner'],
        ['LC', 'Lina Cruz', 'Manager'],
        ['DS', 'Daylight Studio', 'Merchant'],
      ].map(([initials, name, role]) => (
        <PreviewRow
          badge={initials}
          detail={role}
          key={name}
          name={name}
          status="Active"
        />
      ))}
    </PreviewFrame>
  );
}

function PreviewFrame({
  title,
  action,
  children,
}: {
  title: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border-strong bg-surface p-5 shadow-[0_10px_30px_rgb(23_23_23/0.07)] sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="font-semibold tracking-[-0.02em]">{title}</p>
        <span className="rounded-lg bg-action px-3 py-2 text-[0.65rem] font-semibold text-surface">
          {action}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function PreviewRow({
  badge,
  name,
  detail,
  status,
}: {
  badge: string;
  name: string;
  detail: string;
  status?: string;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-hairline py-4 first:border-t-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-xs font-semibold text-muted">
        {badge}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="mt-1 text-xs text-faint">{detail}</p>
      </div>
      {status ? (
        <span className="ml-auto rounded-full border border-hairline px-2 py-1 text-[0.6rem] text-muted">
          {status}
        </span>
      ) : (
        <Icon
          name="chevron"
          className="ml-auto size-4 -rotate-90 text-selected-border"
        />
      )}
    </div>
  );
}
