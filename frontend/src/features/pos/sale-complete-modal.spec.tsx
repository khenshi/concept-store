import { fireEvent, render, screen } from '@testing-library/react';
import { SaleCompleteModal } from './sale-complete-modal';
import type { Sale } from './pos.types';

const sale: Sale = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  branchId: '33333333-3333-4333-8333-333333333333',
  cashierId: '44444444-4444-4444-8444-444444444444',
  saleNumber: 'S-ABC123',
  clientTransactionId: '55555555-5555-4555-8555-555555555555',
  subtotal: '900.00',
  discountTotal: '0.00',
  total: '900.00',
  completedAt: '2026-08-30T02:00:00.000Z',
  branch: { id: 'branch-id', name: 'Makati Main', code: 'MKT' },
  cashier: {
    id: 'cashier-id',
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria@example.com',
  },
  items: [
    {
      id: 'item-id',
      productId: 'product-id',
      merchantId: 'merchant-id',
      productName: 'Handwoven pouch',
      productSku: 'AMH-01',
      productBarcode: null,
      merchantName: 'Amihan Goods',
      quantity: 2,
      unitPrice: '450.00',
      subtotal: '900.00',
      discountAmount: '0.00',
      total: '900.00',
    },
  ],
  payments: [
    {
      id: 'payment-id',
      method: 'CASH',
      amount: '900.00',
      referenceNumber: null,
      confirmedById: 'cashier-id',
      paidAt: '2026-08-30T02:00:00.000Z',
    },
  ],
};

describe('SaleCompleteModal', () => {
  it('links the completed sale to its branch-scoped receipt', () => {
    render(<SaleCompleteModal sale={sale} onNewSale={vi.fn()} />);

    expect(
      screen.getByText('S-ABC123 was recorded at Makati Main.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'View receipt' })).toHaveAttribute(
      'href',
      `/app/organizations/${sale.organizationId}/pos/sales/${sale.id}/receipt?branchId=${sale.branchId}`,
    );
  });

  it('starts a new sale only after the cashier chooses the action', () => {
    const onNewSale = vi.fn();
    render(<SaleCompleteModal sale={sale} onNewSale={onNewSale} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start new sale' }));
    expect(onNewSale).toHaveBeenCalledOnce();
  });
});
