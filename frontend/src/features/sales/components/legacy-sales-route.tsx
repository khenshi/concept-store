'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import type { PosScope } from '@/features/pos/model/pos.types';
import { SalesAccess } from './sales-access';
import { BranchSales } from './branch-sales';
import { SaleDetail } from './sale-detail';

function StaffRedirect({
  organizationId,
  branchId,
  saleId,
}: PosScope & { saleId?: string }) {
  const router = useRouter();
  const href = `/app/organizations/${organizationId}/branches/${branchId}/pos/sales${saleId ? `/${saleId}` : ''}`;
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return <ListSkeleton label="Opening POS sales history" />;
}

export function LegacySalesRoute(props: PosScope & { saleId?: string }) {
  return (
    <SalesAccess organizationId={props.organizationId}>
      {(role) =>
        role === 'MERCHANT' ? (
          props.saleId ? (
            <SaleDetail {...props} saleId={props.saleId} />
          ) : (
            <BranchSales {...props} />
          )
        ) : (
          <StaffRedirect {...props} />
        )
      }
    </SalesAccess>
  );
}
