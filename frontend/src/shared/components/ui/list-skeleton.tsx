export function ListSkeleton({
  rows = 3,
  rowClassName = 'h-16',
  label,
  className = 'mt-5',
}: {
  rows?: number;
  rowClassName?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`${className} grid`} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          className={`${rowClassName} flex animate-pulse items-center`}
          key={index}
          aria-hidden="true"
        >
          <span className="h-3 w-3/4 rounded bg-selected" />
        </div>
      ))}
    </div>
  );
}
