import Link from 'next/link';

type BrandWordmarkProps = {
  className?: string;
  href?: string;
  showTagline?: boolean;
};

export function BrandWordmark({
  className = '',
  href = '/',
  showTagline = false,
}: BrandWordmarkProps) {
  return (
    <Link
      className={`inline-flex w-fit items-center gap-2.5 no-underline ${className}`}
      href={href}
      aria-label="Kapwesto home"
    >
      <span
        className="grid size-8 place-items-center rounded-lg bg-action text-[0.65rem] font-bold tracking-[-0.04em] text-surface"
        aria-hidden="true"
      >
        K
      </span>
      <span className="grid gap-0.5">
        <strong className="tracking-[-0.02em]">Kapwesto</strong>
        {showTagline ? (
          <small className="text-[0.68rem] font-medium tracking-normal text-muted">
            Secure concept store workspaces.
          </small>
        ) : null}
      </span>
    </Link>
  );
}
