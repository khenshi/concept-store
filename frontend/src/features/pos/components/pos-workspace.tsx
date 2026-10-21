'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceChrome } from '@/features/app-shell/components/workspace-chrome-context';
import { BranchSales } from '@/features/sales/components/branch-sales';
import { SaleDetail } from '@/features/sales/components/sale-detail';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  refundAttemptKey,
  useRefundAttempt,
} from '@/features/refunds/model/refund-attempt';
import { useRefundNavigationGuard } from '@/features/refunds/model/refund-navigation';
import type { PosScope } from '../model/pos.types';
import { BranchPos } from './branch-pos';

export function PosWorkspace({
  children,
  ...scope
}: PosScope & { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  const attemptKey = refundAttemptKey(scope.organizationId, user?.id ?? '');
  const refund = useRefundAttempt(attemptKey);
  useRefundNavigationGuard(attemptKey, { ...scope, saleId: '' });
  const { exitPosFullscreen } = useWorkspaceChrome();
  const base = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos`;
  const refundsActive = pathname === `${base}/refunds`;
  const recovering = Boolean(
    refund &&
    refund.scope.branchId === scope.branchId &&
    organization?.id === scope.organizationId &&
    (organization.role === 'OWNER' || organization.role === 'MANAGER'),
  );
  const cartActive = pathname === base && !recovering;
  const historyActive = pathname === `${base}/sales` && !recovering;
  useEffect(() => () => exitPosFullscreen(), [exitPosFullscreen]);
  return (
    <BranchPos
      {...scope}
      cartActive={cartActive}
      refundsActive={refundsActive}
      history={(visible) => (
        <>
          <div hidden={!historyActive}>
            <BranchSales
              {...scope}
              embedded
              active={visible && historyActive}
            />
          </div>
          {!visible || historyActive ? null : recovering &&
            !refundsActive &&
            pathname !== `${base}/sales/${refund!.scope.saleId}` ? (
            <SaleDetail {...scope} saleId={refund!.scope.saleId} embedded />
          ) : (
            children
          )}
        </>
      )}
    />
  );
}
