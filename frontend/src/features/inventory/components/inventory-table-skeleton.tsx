type InventoryTableSkeletonProps = {
  variant: 'stock' | 'integrity';
  canWrite?: boolean;
  label: string;
};

const stockGrid = (canWrite: boolean) =>
  canWrite
    ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(6.5rem,0.75fr)_minmax(7rem,0.75fr)_minmax(7rem,0.6fr)_minmax(12rem,1fr)]'
    : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(6.5rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)]';

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-selected ${className}`}
    />
  );
}

function StockSkeleton({ canWrite }: { canWrite: boolean }) {
  const grid = stockGrid(canWrite);
  const columns = 5;

  return (
    <div className="overflow-x-auto" aria-hidden="true">
      <div
        className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${grid}`}
      >
        {Array.from({ length: columns }, (_, index) => (
          <SkeletonBar className="h-2.5 w-2/3" key={index} />
        ))}
      </div>
      <div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-4 sm:px-4 lg:items-center ${grid}`}
            key={index}
          >
            <div className="min-w-0 space-y-2">
              <SkeletonBar className="h-3.5 w-4/5" />
              <SkeletonBar className="h-2.5 w-3/5" />
            </div>
            <SkeletonBar className="h-3 w-4/5" />
            <SkeletonBar className="h-3 w-3/5" />
            <div className="min-w-0 space-y-2">
              <SkeletonBar className="h-3 w-3/5" />
              <SkeletonBar className="h-2.5 w-2/5" />
            </div>
            <div className="flex items-center gap-2">
              {canWrite ? (
                <>
                  <SkeletonBar className="h-8 w-20 rounded-full" />
                  <SkeletonBar className="h-8 w-20 rounded-full" />
                </>
              ) : null}
              <SkeletonBar className="h-8 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegritySkeleton() {
  return (
    <div className="overflow-x-auto p-6" aria-hidden="true">
      <div className="mb-4">
        <SkeletonBar className="h-3 w-2/5" />
      </div>
      <div className="min-w-[25rem]">
        <div className="data-column-header hidden grid-cols-[minmax(0,1.4fr)_minmax(13rem,auto)] gap-x-6 gap-y-3 sm:grid">
          <SkeletonBar className="h-2.5 w-2/5" />
          <SkeletonBar className="h-2.5 w-2/5" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="data-row grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(13rem,auto)] sm:items-center"
            key={index}
          >
            <div className="min-w-0 space-y-2">
              <SkeletonBar className="h-3.5 w-3/5" />
              <SkeletonBar className="h-2.5 w-2/5" />
            </div>
            <SkeletonBar className="h-3 w-4/5" />
            <SkeletonBar className="h-2.5 w-1/4 sm:col-span-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InventoryTableSkeleton({
  variant,
  canWrite = false,
  label,
}: InventoryTableSkeletonProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {variant === 'stock' ? (
        <StockSkeleton canWrite={canWrite} />
      ) : (
        <IntegritySkeleton />
      )}
    </div>
  );
}
