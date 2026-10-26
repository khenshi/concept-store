import Link from 'next/link';
import { buttonStyles, Button } from './button';

type RouteRecoveryProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  onRetry?: () => void;
};

export function RouteRecovery({
  title,
  description,
  primaryHref,
  primaryLabel,
  onRetry,
}: RouteRecoveryProps) {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink sm:px-8 sm:py-16">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center">
        <section
          aria-labelledby="route-recovery-title"
          className="card-surface w-full p-6 sm:p-8"
        >
          <h1
            id="route-recovery-title"
            className="text-page break-words font-semibold text-ink"
          >
            {title}
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
            <Link
              className={buttonStyles({ variant: 'secondary' })}
              href={primaryHref}
            >
              {primaryLabel}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
