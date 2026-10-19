import type { ReactNode } from 'react';
import { Notice } from './notice';

export type OperationalCollectionControlsPlacement = 'stacked' | 'inline';

type OperationalCollectionProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  controls?: ReactNode;
  controlsPlacement?: OperationalCollectionControlsPlacement;
  children: ReactNode;
  className?: string;
  surface?: 'card' | 'data' | 'open';
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export function OperationalPage({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto mt-5 w-full max-w-7xl sm:mt-6">
      {children}
    </section>
  );
}

export function OperationalCollection({
  id,
  title,
  description,
  action,
  controls,
  controlsPlacement = 'stacked',
  children,
  className = '',
  surface = 'card',
  role,
  tabIndex,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: OperationalCollectionProps) {
  const open = surface === 'open';
  const inlineControls = controlsPlacement === 'inline';
  const surfaceClass =
    surface === 'data'
      ? 'data-surface'
      : open
        ? 'mt-7 bg-surface'
        : 'mt-6 card-surface';
  return (
    <section
      id={id}
      className={`${surfaceClass} text-ink ${className}`}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      <header
        className={
          inlineControls
            ? 'grid gap-4 border-b border-hairline px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'
            : `flex items-start justify-between gap-5 max-sm:grid ${open ? 'pb-4' : 'border-b border-hairline px-5 py-5 sm:px-6'}`
        }
      >
        <div className="min-w-0 break-words">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        {inlineControls ? (
          controls || action ? (
            <div className="flex min-w-0 flex-wrap items-end justify-end gap-4">
              {controls}
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
          ) : null
        ) : action ? (
          <div className="shrink-0">{action}</div>
        ) : null}
      </header>
      {!inlineControls && controls ? (
        <div
          className={`${open ? 'bg-surface py-4' : 'border-b border-hairline bg-subtle px-5 py-4 sm:px-6'}`}
        >
          {controls}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function OperationalPanel(
  props: OperationalCollectionProps & { variant?: 'card' | 'open' },
) {
  const { variant, surface, ...rest } = props;
  return (
    <OperationalCollection {...rest} surface={surface ?? variant ?? 'card'} />
  );
}

export function OperationalToolbar({
  children,
  className = '',
  variant = 'card',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'card' | 'open';
}) {
  return (
    <div
      className={`${variant === 'open' ? 'bg-surface py-4' : 'border-b border-hairline bg-subtle px-5 py-4 sm:px-6'} ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="filter-field grid min-w-0 gap-2">
      <label className="text-label font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function StatusNotice({
  children,
  tone = 'success',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning';
}) {
  return (
    <Notice className="mt-5" tone={tone === 'success' ? 'success' : 'warning'}>
      {children}
    </Notice>
  );
}
