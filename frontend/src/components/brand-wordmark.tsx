import Link from 'next/link';

type BrandWordmarkProps = {
  className?: string;
};

export function BrandWordmark({ className = '' }: BrandWordmarkProps) {
  return (
    <Link
      className={`inline-flex w-fit items-center gap-2.5 font-bold tracking-[-0.02em] no-underline ${className}`}
      href="/"
      aria-label="Concept Store home"
    >
      <span
        className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-[0.65rem] font-bold tracking-[-0.04em] text-white"
        aria-hidden="true"
      >
        CS
      </span>
      <span>Concept Store</span>
    </Link>
  );
}
