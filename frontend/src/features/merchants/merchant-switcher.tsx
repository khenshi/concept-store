'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SelectControl } from '@/components/ui/select-control';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';

export function MerchantSwitcher({
  organizationId,
  merchantId,
}: {
  organizationId: string;
  merchantId: string;
}) {
  const router = useRouter();
  const { merchants, merchantsStatus, loadMerchants } =
    useOrganizationWorkspaceContext();

  useEffect(() => {
    if (merchantsStatus === 'idle') {
      void loadMerchants().catch(() => undefined);
    }
  }, [loadMerchants, merchantsStatus]);

  return (
    <div className="grid gap-2">
      <label
        className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase"
        htmlFor="merchant-switcher"
      >
        Merchant
      </label>
      <SelectControl
        className="min-h-11 min-w-[min(100%,20rem)] rounded-[0.6rem] border border-slate-200 bg-white px-3 text-base font-bold text-slate-950"
        id="merchant-switcher"
        value={merchantId}
        disabled={merchantsStatus === 'loading'}
        onValueChange={(value) =>
          router.push(`/app/organizations/${organizationId}/merchants/${value}`)
        }
      >
        {merchants.length === 0 ? (
          <option value={merchantId}>Current merchant</option>
        ) : null}
        {merchants.map((merchant) => (
          <option key={merchant.id} value={merchant.id}>
            {merchant.name}
          </option>
        ))}
      </SelectControl>
    </div>
  );
}
