type InventoryMovementTableSkeletonProps = {
  variant: 'records' | 'history';
  canWrite: boolean;
  label: string;
};

const recordsGrid = (canWrite: boolean) =>
  canWrite
    ? 'lg:grid-cols-[minmax(9rem,1.35fr)_minmax(7rem,0.8fr)_minmax(5rem,0.65fr)_minmax(5rem,0.65fr)_minmax(5rem,0.65fr)_minmax(7rem,0.9fr)_minmax(4.5rem,0.5fr)] xl:grid-cols-[minmax(15rem,1.4fr)_minmax(8rem,0.85fr)_minmax(7rem,0.7fr)_minmax(6rem,0.65fr)_minmax(7rem,0.7fr)_minmax(10rem,1fr)_minmax(5rem,0.55fr)]'
    : 'lg:grid-cols-[minmax(9rem,1.4fr)_minmax(7rem,0.85fr)_minmax(5rem,0.7fr)_minmax(5rem,0.65fr)_minmax(5rem,0.7fr)_minmax(4.5rem,0.5fr)] xl:grid-cols-[minmax(15rem,1.45fr)_minmax(8rem,0.9fr)_minmax(7rem,0.75fr)_minmax(6rem,0.7fr)_minmax(7rem,0.75fr)_minmax(5rem,0.55fr)]';

const historyGrid = (canWrite: boolean) =>
  canWrite
    ? 'lg:grid-cols-[minmax(8rem,1.1fr)_minmax(5rem,0.65fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_minmax(7rem,1fr)_minmax(4.5rem,0.5fr)] xl:grid-cols-[minmax(10rem,1.15fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(12rem,1.25fr)_minmax(5rem,0.55fr)]'
    : 'lg:grid-cols-[minmax(8rem,1.1fr)_minmax(5rem,0.65fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_minmax(4.5rem,0.5fr)] xl:grid-cols-[minmax(10rem,1.15fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(5rem,0.55fr)]';

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-selected ${className}`}
    />
  );
}

function ProductCell() {
  return (
    <div className="min-w-0 space-y-2">
      <SkeletonBar className="h-3.5 w-4/5" />
      <SkeletonBar className="h-2.5 w-3/5" />
    </div>
  );
}

function DateCell() {
  return (
    <div className="min-w-0 space-y-2">
      <SkeletonBar className="h-3 w-4/5" />
      <SkeletonBar className="h-2.5 w-3/5" />
    </div>
  );
}

function MovementRow({
  variant,
  canWrite,
  grid,
}: {
  variant: InventoryMovementTableSkeletonProps['variant'];
  canWrite: boolean;
  grid: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`data-row grid min-w-0 gap-x-3 gap-y-3 px-3 py-4 sm:px-4 lg:items-center xl:min-w-0 xl:gap-x-6 ${grid}`}
    >
      {variant === 'records' ? <ProductCell /> : <DateCell />}
      {variant === 'records' ? <DateCell /> : null}
      <SkeletonBar className="h-3 w-3/5" />
      <SkeletonBar className="h-3 w-4/5" />
      <SkeletonBar className="h-3 w-3/5" />
      {canWrite ? <SkeletonBar className="h-3 w-4/5" /> : null}
      <SkeletonBar className="h-7 w-12 rounded-full" />
    </div>
  );
}

export function InventoryMovementTableSkeleton({
  variant,
  canWrite,
  label,
}: InventoryMovementTableSkeletonProps) {
  const grid =
    variant === 'records' ? recordsGrid(canWrite) : historyGrid(canWrite);
  const columns = variant === 'records' ? (canWrite ? 7 : 6) : canWrite ? 6 : 5;
  const minWidth =
    variant === 'records'
      ? 'lg:min-w-[47rem]'
      : canWrite
        ? 'lg:min-w-[40rem]'
        : 'lg:min-w-[32rem]';

  return (
    <div
      role="status"
      aria-label={label}
      className="overflow-x-auto"
      aria-busy="true"
    >
      <div
        aria-hidden="true"
        className={`data-column-header hidden gap-x-3 gap-y-3 lg:grid lg:items-center xl:min-w-0 xl:gap-x-6 ${minWidth} ${grid}`}
      >
        {Array.from({ length: columns }, (_, index) => (
          <SkeletonBar className="h-2.5 w-2/3" key={index} />
        ))}
      </div>
      <div className={`m-0 ${minWidth}`}>
        {Array.from({ length: 5 }, (_, index) => (
          <MovementRow
            key={index}
            variant={variant}
            canWrite={canWrite}
            grid={grid}
          />
        ))}
      </div>
    </div>
  );
}
