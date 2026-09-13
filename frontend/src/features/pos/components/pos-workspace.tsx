'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BranchSales } from '@/features/sales/components/branch-sales';
import type { PosScope } from '../model/pos.types';
import { BranchPos } from './branch-pos';

export function PosWorkspace({
  children,
  ...scope
}: PosScope & { children: ReactNode }) {
  const pathname = usePathname();
  const base = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos`;
  const cartActive = pathname === base;
  const historyActive = pathname === `${base}/sales`;
  return (
    <BranchPos
      {...scope}
      cartActive={cartActive}
      history={(visible) => (
        <>
          <div hidden={!historyActive}>
            <BranchSales
              {...scope}
              embedded
              active={visible && historyActive}
            />
          </div>
          {!visible || historyActive ? null : children}
        </>
      )}
    />
  );
}
