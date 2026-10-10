export const branchDirectoryGrid =
  'lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,1.1fr)_minmax(6rem,0.6fr)_minmax(8rem,0.7fr)_minmax(7rem,auto)]';

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-selected ${className}`}
    />
  );
}

export function BranchTableSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <div className="overflow-x-auto" aria-hidden="true">
        <div
          className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${branchDirectoryGrid}`}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBar className="h-2.5 w-2/3" key={index} />
          ))}
        </div>
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-5 sm:px-4 lg:items-center ${branchDirectoryGrid}`}
              key={index}
            >
              <div className="min-w-0 space-y-2">
                <SkeletonBar className="h-3.5 w-4/5" />
                <SkeletonBar className="h-2.5 w-3/5" />
              </div>
              <div className="min-w-0 space-y-2">
                <SkeletonBar className="h-3 w-3/5" />
                <SkeletonBar className="h-2.5 w-4/5" />
              </div>
              <SkeletonBar className="h-3 w-1/3" />
              <SkeletonBar className="h-7 w-20 rounded-full" />
              <SkeletonBar className="h-8 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
