import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type { PosScope } from '../model/pos.types';
import { completedSaleSchema, type CheckoutCommand } from '../model/checkout';

export async function completeCheckout(
  request: AuthenticatedRequest,
  scope: PosScope,
  command: CheckoutCommand,
) {
  const sale = completedSaleSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/sales`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      },
    ),
  );
  if (
    sale.organizationId !== scope.organizationId ||
    sale.branchId !== scope.branchId
  )
    throw new Error('Receipt scope is inconsistent.');
  if (
    sale.paymentMethod !== command.paymentMethod ||
    sale.items.length !== command.items.length ||
    sale.items.some(
      (item) =>
        !command.items.some(
          (line) =>
            line.branchInventoryId === item.branchInventoryId &&
            line.quantity === item.quantity &&
            line.expectedUnitPrice === item.unitPrice,
        ),
    ) ||
    ('cashTender' in command
      ? sale.cashTender !== command.cashTender
      : sale.paymentReference !== command.paymentReference)
  )
    throw new Error('Receipt does not match the checkout command.');
  return sale;
}
