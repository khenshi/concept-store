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
    <div className={className} role="alert">
      {title ? <h3 className="m-0 text-base font-bold">{title}</h3> : null}
      <p className={title ? 'mt-2 leading-7 text-slate-500' : ''}>{message}</p>
      <button
        className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
        type="button"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
