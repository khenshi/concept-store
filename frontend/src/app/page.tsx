import Link from 'next/link';
import { BrandWordmark } from '@/shared/components/branding/brand-wordmark';

const foundations = [
  {
    title: 'Secure organization access',
    description:
      'Create isolated organization workspaces protected by authentication and role-based access.',
  },
  {
    title: 'Branches in one place',
    description:
      'Maintain the identity and address of every physical store location.',
  },
  {
    title: 'Team membership',
    description:
      'Invite members, assign roles, and protect every organization with a required owner.',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandWordmark />
          <nav className="flex items-center gap-4" aria-label="Account">
            <Link
              className="font-bold text-slate-700 no-underline"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white no-underline"
              href="/register"
            >
              Create your workspace
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-16 lg:py-28">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-emerald-700 uppercase">
            Multi-tenant foundation
          </p>
          <h1 className="mt-5 max-w-3xl text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.95] font-bold tracking-[-0.06em]">
            Start with a clear foundation for your concept store.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            Kapwesto currently provides secure organizations, branches, team
            roles, and invitation-based member access. Operational modules will
            be planned and introduced incrementally.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white no-underline"
              href="/register"
            >
              Create your workspace
            </Link>
            <Link
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 no-underline"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-4 self-center">
          {foundations.map((foundation) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              key={foundation.title}
            >
              <h2 className="text-lg font-bold">{foundation.title}</h2>
              <p className="mt-2 leading-7 text-slate-600">
                {foundation.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-500">
        Kapwesto — foundation first, expanded milestone by milestone.
      </footer>
    </main>
  );
}
