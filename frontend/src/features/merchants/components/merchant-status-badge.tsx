import type { MerchantStatus } from '../model/merchant.types';

const styles: Record<MerchantStatus, string> = {
  ACTIVE: 'border-success/20 bg-success/5 text-success-ink',
  INACTIVE: 'border-hairline bg-subtle text-muted',
  SUSPENDED: 'border-warning/20 bg-warning/5 text-warning',
  ENDED: 'border-hairline bg-subtle text-muted',
};

export function MerchantStatusBadge({ status }: { status: MerchantStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${styles[status]}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
