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
    <div className={`${className} grid gap-3`} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          className={`${rowClassName} animate-pulse rounded-lg bg-slate-100`}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
