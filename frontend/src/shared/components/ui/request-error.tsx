export function RequestError({
  title,
  message,
  onRetry,
  className = '',
}: {
  title?: string;
  message: string;
  onRetry(): void;
  className?: string;
}) {
  return (
    <div className={`border-l-2 border-danger pl-4 ${className}`} role="alert">
      {title ? (
        <h3 className="m-0 text-base font-semibold text-ink">{title}</h3>
      ) : null}
      <p className={title ? 'mt-2 leading-7 text-muted' : 'text-ink'}>
        {message}
      </p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
import { Button } from './button';
