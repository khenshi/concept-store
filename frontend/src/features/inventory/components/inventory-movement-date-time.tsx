const philippineDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
});

const philippineTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
});

export function InventoryMovementDateTime({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <time className="min-w-0 tabular-nums" dateTime={value}>
      <span className="block text-sm font-medium text-ink">
        {philippineDateFormatter.format(date)}
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted">
        {philippineTimeFormatter.format(date)} (PH)
      </span>
    </time>
  );
}
