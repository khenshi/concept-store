import type { MerchantStatus } from '../model/merchant.types';

const styles: Record<MerchantStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  INACTIVE: 'border-slate-200 bg-slate-50 text-slate-600',
  SUSPENDED: 'border-amber-200 bg-amber-50 text-amber-800',
  ENDED: 'border-red-200 bg-red-50 text-red-700',
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
