import Link from 'next/link';
import { BrandWordmark } from '@/components/brand-wordmark';

const storeCapabilities = [
  {
    number: '01',
    title: 'One operational record',
    description:
      'Keep organizations, branches, teams, and merchants connected instead of scattered across separate files.',
  },
  {
    number: '02',
    title: 'Access that follows each role',
    description:
      'Give owners, managers, cashiers, and merchants a view shaped around the work they are allowed to do.',
  },
  {
    number: '03',
    title: 'Built around merchant retail',
    description:
      'Create a foundation for products, inventory, sales attribution, agreements, and settlements to work together.',
  },
];

const eyebrowClass =
  'mb-4 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700';
const sectionHeadingClass =
  'text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-bold tracking-[-0.045em] text-slate-900';
const primaryLinkClass =
  'inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4.5 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-emerald-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <header className="mx-auto grid min-h-19 w-[min(calc(100%_-_3rem),72rem)] grid-cols-[1fr_auto] items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
        <BrandWordmark />
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Main navigation"
        >
          {[
            ['Platform', '#platform'],
            ['Built for', '#built-for'],
            ['How it works', '#workflow'],
          ].map(([label, href]) => (
            <a
              className="text-sm font-semibold text-slate-700 no-underline hover:text-emerald-700"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-5">
          <Link
            className="hidden text-sm font-semibold text-slate-700 no-underline hover:text-emerald-700 sm:block"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className={`${primaryLinkClass} min-h-10 px-3.5 py-2 text-xs`}
            href="/register"
          >
            Get started
          </Link>
        </div>
      </header>

      <section
        className="mx-auto grid min-h-[42rem] w-[min(calc(100%_-_3rem),72rem)] items-center gap-12 py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(29rem,1.05fr)] lg:gap-20 lg:py-20"
        aria-labelledby="page-title"
      >
        <div className="max-w-2xl">
          <p className={eyebrowClass}>Built for multi-merchant retail</p>
          <h1
            id="page-title"
            className="max-w-[11ch] text-[clamp(3rem,7vw,5.25rem)] leading-[1.02] font-bold tracking-[-0.05em] text-slate-900"
          >
            Run your concept store with{' '}
            <span className="text-emerald-600">one clear system.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[1.08rem] leading-7 text-slate-500">
            Bring branches, teams, and independent merchants into one organized
            workspace—built for the way concept stores actually operate.
          </p>
          <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link className={primaryLinkClass} href="/register">
              Create your workspace
            </Link>
            <a
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 no-underline hover:text-emerald-700"
              href="#platform"
            >
              Explore the platform <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Clear setup. Role-aware access. Your organization stays separated.
          </p>
        </div>

        <div
          className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1.5rem_4rem_rgb(15_23_42/0.08)] lg:[transform:perspective(80rem)_rotateY(-2deg)_rotateX(1deg)]"
          aria-label="Store workspace preview"
        >
          <div className="flex min-h-13 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2 text-[0.65rem] font-bold">
              <span
                className="size-3 rounded-sm bg-emerald-600"
                aria-hidden="true"
              />
              North &amp; Pine
            </div>
            <span
              className="grid size-7 place-items-center rounded-full bg-emerald-100 text-[0.5rem] font-bold text-emerald-700"
              aria-hidden="true"
            >
              MP
            </span>
          </div>
          <div className="grid min-h-92 sm:grid-cols-[4.25rem_1fr]">
            <div
              className="hidden flex-col gap-5 border-r border-slate-200 bg-slate-50 px-4 py-8 sm:flex"
              aria-hidden="true"
            >
              {[true, false, false, false].map((active, index) => (
                <span
                  className={`h-1 w-full rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  key={index}
                />
              ))}
            </div>
            <div className="min-w-0 bg-slate-50/40 p-5 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <span className="text-[0.55rem] text-slate-500">
                    Store overview
                  </span>
                  <strong className="text-sm tracking-tight">
                    Good morning, Mara
                  </strong>
                </div>
                <span className="rounded-md bg-emerald-600 px-3 py-2 text-[0.5rem] font-bold text-white">
                  Add merchant
                </span>
              </div>
              <div
                className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-hidden="true"
              >
                {[
                  ['Branches', '03', 'Active locations'],
                  ['Merchants', '24', 'Across your store'],
                  ['Team', '12', 'Active members'],
                ].map(([label, value, note], index) => (
                  <div
                    className={`grid gap-1 rounded-lg border border-slate-200 bg-white p-3 ${index === 2 ? 'hidden sm:grid' : ''}`}
                    key={label}
                  >
                    <span className="text-[0.5rem] text-slate-500">
                      {label}
                    </span>
                    <strong>{value}</strong>
                    <small className="text-[0.5rem] text-slate-500">
                      {note}
                    </small>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-[0.55rem]">
                  <strong>Recently added merchants</strong>
                  <span className="font-bold text-emerald-700">View all</span>
                </div>
                {[
                  [
                    'AR',
                    'Amihan Rituals',
                    'Quezon City · Makati',
                    'bg-emerald-100 text-emerald-700',
                  ],
                  [
                    'SL',
                    'Sinta Local',
                    'Makati',
                    'bg-amber-100 text-amber-800',
                  ],
                ].map(([initials, name, place, color], index) => (
                  <div
                    className={`flex items-center gap-3 py-3 ${index ? 'border-t border-slate-200' : ''}`}
                    key={name}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.45rem] font-bold ${color}`}
                    >
                      {initials}
                    </span>
                    <span className="grid flex-1 gap-0.5 text-[0.55rem]">
                      <strong>{name}</strong>
                      <small className="text-[0.5rem] text-slate-500">
                        {place}
                      </small>
                    </span>
                    <span className="text-[0.5rem] font-bold text-emerald-700">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-[min(calc(100%_-_3rem),72rem)] border-y border-slate-200 py-9 text-center"
        aria-label="Platform principles"
      >
        <p className="m-0 text-xs text-slate-500">
          One connected workspace for every side of your store
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold text-slate-700 sm:gap-x-8">
          {['Organization', 'Branches', 'Team', 'Merchants'].map(
            (item, index) => (
              <span key={item}>
                {index > 0 && (
                  <span
                    className="mr-4 text-slate-300 sm:mr-8"
                    aria-hidden="true"
                  >
                    •
                  </span>
                )}
                {item}
              </span>
            ),
          )}
        </div>
      </section>

      <section
        className="mx-auto w-[min(calc(100%_-_3rem),72rem)] py-24 lg:py-32"
        id="platform"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className={eyebrowClass}>A calmer way to operate</p>
          <h2 className={sectionHeadingClass}>
            Clarity across the whole store.
          </h2>
          <p className="mt-5 leading-7 text-slate-500">
            Start with a dependable foundation today, designed to connect the
            rest of your store operations as the platform grows.
          </p>
        </div>
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {storeCapabilities.map((capability) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-8"
              key={capability.number}
            >
              <span className="grid size-10 place-items-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-700">
                {capability.number}
              </span>
              <h3 className="mt-10 text-lg font-bold tracking-tight text-slate-900">
                {capability.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {capability.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mx-auto grid w-[min(calc(100%_-_3rem),72rem)] items-center gap-12 py-24 lg:grid-cols-2 lg:gap-28 lg:py-32"
        id="built-for"
      >
        <div
          className="relative order-2 min-h-112 rounded-2xl bg-slate-50 lg:order-1"
          aria-hidden="true"
        >
          <div className="absolute top-14 left-6 grid min-h-64 w-[calc(100%-3rem)] rounded-xl border border-slate-200 bg-white p-7 shadow-[0_1.25rem_3rem_rgb(15_23_42/0.07)] sm:left-12 sm:w-[65%]">
            <span className="text-[0.68rem] font-extrabold tracking-[0.08em] text-emerald-700 uppercase">
              Owner workspace
            </span>
            <strong className="mt-3 max-w-60 text-xl leading-tight tracking-tight">
              A complete view of your operation
            </strong>
            <div className="mt-10 grid gap-3">
              {['w-[90%]', 'w-[72%]', 'w-[82%]'].map((width) => (
                <i
                  className={`h-2.5 rounded-full bg-slate-200 ${width}`}
                  key={width}
                />
              ))}
            </div>
          </div>
          <div className="absolute right-4 bottom-12 grid w-[70%] rounded-xl border border-slate-200 bg-white p-7 shadow-[0_1.25rem_3rem_rgb(15_23_42/0.07)] sm:right-8 sm:w-[55%]">
            <span className="text-[0.68rem] font-extrabold tracking-[0.08em] text-emerald-700 uppercase">
              Merchant access
            </span>
            <strong className="mt-3 max-w-60 text-xl leading-tight tracking-tight">
              Only the information that belongs to them
            </strong>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-200">
              <i className="block h-full w-[68%] bg-emerald-600" />
            </div>
          </div>
        </div>
        <div className="lg:order-2">
          <p className={eyebrowClass}>One system, separate access</p>
          <h2 className={sectionHeadingClass}>
            Every role sees what matters to them.
          </h2>
          <p className="mt-5 max-w-xl leading-7 text-slate-500">
            Owners and managers can coordinate store operations while merchants
            work within their own authorized view. The experience stays
            connected without blurring responsibilities or data boundaries.
          </p>
          <ul className="mt-8 grid gap-4 p-0 text-sm font-semibold text-slate-700">
            {[
              'Organization-aware access from the start',
              'Dedicated paths for store teams and merchants',
              'Built to support multiple physical branches',
            ].map((item) => (
              <li className="flex items-center gap-3" key={item}>
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-24 lg:py-32" id="workflow">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className={eyebrowClass}>Designed for the real workflow</p>
            <h2 className={sectionHeadingClass}>
              From merchant onboarding to payout.
            </h2>
            <p className="mt-5 leading-7 text-slate-500">
              Concept Store is being built around the full operating
              relationship, so each future step has a clear place in the same
              system.
            </p>
          </div>
          <ol className="mt-16 grid grid-cols-2 gap-y-6 p-0 sm:grid-cols-3 lg:grid-cols-6">
            {[
              'Merchant',
              'Space',
              'Products',
              'Sales',
              'Settlement',
              'Payout',
            ].map((step, index) => (
              <li
                className="grid gap-3 border-t border-slate-300 pt-5 text-sm"
                key={step}
              >
                <span className="text-xs font-extrabold text-emerald-700">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="grid justify-items-center px-6 py-24 text-center lg:py-32"
        aria-labelledby="cta-title"
      >
        <p className={eyebrowClass}>Start with a clear foundation</p>
        <h2 className={`${sectionHeadingClass} max-w-[20ch]`} id="cta-title">
          Bring your concept store into one workspace.
        </h2>
        <p className="mt-5 max-w-xl leading-7 text-slate-500">
          Create your account and set up your organization, team, and branches.
        </p>
        <Link className={`${primaryLinkClass} mt-8`} href="/register">
          Get started
        </Link>
      </section>

      <footer className="mx-auto grid w-[min(calc(100%_-_3rem),72rem)] grid-cols-[1fr_auto] items-center gap-8 border-t border-slate-200 py-8 sm:grid-cols-[1fr_auto_1fr]">
        <BrandWordmark />
        <p className="hidden text-center text-xs text-slate-500 sm:block">
          Clear operations for multi-merchant retail.
        </p>
        <Link
          className="justify-self-end text-sm font-semibold text-slate-700 no-underline hover:text-emerald-700"
          href="/login"
        >
          Sign in
        </Link>
      </footer>
    </main>
  );
}
