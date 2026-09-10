import Link from 'next/link';

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 no-underline hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
      href={href}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
