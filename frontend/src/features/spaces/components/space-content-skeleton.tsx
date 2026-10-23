type SpaceContentSkeletonProps = {
  kind: 'branch' | 'merchant';
  owner: boolean;
  own: boolean;
  label?: string;
};

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-selected ${className}`}
    />
  );
}

function BranchRowsSkeleton() {
  const grid =
    'lg:grid-cols-[minmax(8rem,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_11rem]';
  return (
    <>
      <div
        className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${grid}`}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBar className="h-2.5 w-2/3" key={index} />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-5 sm:px-4 sm:grid-cols-2 lg:items-center ${grid}`}
          key={index}
        >
          <div className="min-w-0 space-y-2">
            <SkeletonBar className="h-3.5 w-4/5" />
            <SkeletonBar className="h-2.5 w-3/5" />
          </div>
          <SkeletonBar className="h-3 w-3/5" />
          <SkeletonBar className="h-3 w-3/5" />
          <SkeletonBar className="h-3 w-4/5" />
          <div className="min-w-0 space-y-2">
            <SkeletonBar className="h-7 w-20 rounded-full" />
            <SkeletonBar className="h-2.5 w-4/5" />
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <SkeletonBar className="h-8 w-16 shrink-0 rounded-full" />
            <SkeletonBar className="h-8 w-20 shrink-0 rounded-full" />
            <SkeletonBar className="h-8 w-20 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

function MerchantRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="data-row grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          key={index}
        >
          <div className="min-w-0 space-y-2">
            <SkeletonBar className="h-3.5 w-4/5" />
            <SkeletonBar className="h-2.5 w-3/5" />
            <SkeletonBar className="h-3 w-2/3" />
          </div>
          <div className="min-w-0 space-y-2">
            <SkeletonBar className="h-3 w-4/5" />
            <SkeletonBar className="h-2.5 w-3/5" />
          </div>
          <SkeletonBar className="h-8 w-24 rounded-full" />
        </div>
      ))}
    </>
  );
}

export function SpaceRowsSkeleton({
  kind,
}: Pick<SpaceContentSkeletonProps, 'kind'>) {
  return (
    <div aria-hidden="true" className="mt-5 list-none">
      {kind === 'branch' ? <BranchRowsSkeleton /> : <MerchantRowsSkeleton />}
    </div>
  );
}

export function SpaceContentSkeleton({
  kind,
  owner,
  own,
  label = 'Loading spaces',
}: SpaceContentSkeletonProps) {
  return (
    <section
      className="mt-5 min-w-0 card-surface p-5 sm:p-6"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBar className="h-5 w-24" />
          {owner ? <SkeletonBar className="h-11 w-28 rounded-full" /> : null}
        </div>
        <SkeletonBar className="mt-3 h-4 w-full max-w-md" />
        {kind === 'branch' ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: own ? 3 : 4 }, (_, index) => (
              <SkeletonBar className="h-11 w-full rounded-full" key={index} />
            ))}
          </div>
        ) : (
          <div className="mt-5 flex gap-2">
            <SkeletonBar className="h-11 w-32 rounded-full" />
            <SkeletonBar className="h-11 w-32 rounded-full" />
          </div>
        )}
      </div>
      <SpaceRowsSkeleton kind={kind} />
    </section>
  );
}
