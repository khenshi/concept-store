import type { ReactNode, TableHTMLAttributes } from 'react';

export function OperationalTableFrame({
  children,
  empty,
  footer,
  className = '',
}: {
  children: ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
      {empty ? <div className="px-5 pb-6 sm:px-6">{empty}</div> : null}
      {footer}
    </div>
  );
}

export function OperationalTable({
  children,
  className = '',
  scrollClassName = '',
  tableProps,
}: {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  tableProps?: Omit<
    TableHTMLAttributes<HTMLTableElement>,
    'children' | 'className'
  >;
}) {
  return (
    <div className={`overflow-x-auto ${scrollClassName}`.trim()}>
      <table
        {...tableProps}
        className={`data-table w-full border-collapse text-left text-sm ${className}`.trim()}
      >
        {children}
      </table>
    </div>
  );
}
