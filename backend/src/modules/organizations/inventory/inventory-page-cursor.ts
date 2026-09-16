import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { OrganizationContext } from '../authorization/organization-authorization.types';

export type InventoryCursorScope = {
  kind: 'inventory' | 'eligible-products';
  organizationId: string;
  branchId: string;
  context?: OrganizationContext;
  filters: Record<string, string | undefined>;
};

function fingerprint(scope: InventoryCursorScope): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind: scope.kind,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        userId: scope.context?.userId,
        role: scope.context?.role,
        merchantId: scope.context?.merchantId,
        filters: scope.filters,
      }),
    )
    .digest('hex');
}

export function encodeInventoryCursor(
  id: string,
  scope: InventoryCursorScope,
): string {
  return `${id}.${fingerprint(scope)}`;
}

export function decodeInventoryCursor(
  cursor: string,
  scope: InventoryCursorScope,
): string {
  const [id, hash] = cursor.split('.');
  if (!id || hash !== fingerprint(scope))
    throw new NotFoundException('Page cursor not found');
  return id;
}
