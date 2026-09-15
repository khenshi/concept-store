import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { getMerchant } from '@/features/merchants/api/merchant-api';
import {
  getProduct,
  getProductPlacements,
  updateProduct,
  updateProductStatus,
} from '../api/product-api';
import {
  merchant,
  organizationId,
  placement,
  product,
} from '../model/product.test-fixtures';
import { ProductProfile } from './product-profile';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/features/merchants/api/merchant-api', () => ({
  getMerchant: vi.fn(),
}));
vi.mock('../api/product-api', () => ({
  getProduct: vi.fn(),
  getProductPlacements: vi.fn(),
  updateProduct: vi.fn(),
  updateProductStatus: vi.fn(),
}));

describe('ProductProfile workflows', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'OWNER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(getProduct).mockResolvedValue(product);
    vi.mocked(getMerchant).mockResolvedValue(merchant);
    vi.mocked(getProductPlacements).mockResolvedValue([placement]);
  });
  it('shows independent branch price/stock and links to scoped placement', async () => {
    render(
      <ProductProfile organizationId={organizationId} productId={product.id} />,
    );
    expect(await screen.findByText('PHP 850.00')).toBeInTheDocument();
    expect(
      screen.getByText(/10 units · In stock · threshold 5/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Makati · MKT' })).toHaveAttribute(
      'href',
      `/app/organizations/${organizationId}/branches/${placement.branchId}/inventory/${placement.id}`,
    );
  });
  it.each(['MANAGER', 'MERCHANT'])(
    'keeps product details and placements read-only for %s',
    async (role) => {
      vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
        organization: { role },
        organizationStatus: 'ready',
      } as never);
      render(
        <ProductProfile
          organizationId={organizationId}
          productId={product.id}
        />,
      );
      await screen.findByText('PHP 850.00');
      expect(
        screen.queryByRole('button', { name: 'Edit profile' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Change status' }),
      ).not.toBeInTheDocument();
      expect(getMerchant).toHaveBeenCalledWith(
        request,
        organizationId,
        product.merchantId,
        role,
      );
    },
  );
  it('cancels status confirmation without sending a write, then confirms separately', async () => {
    vi.mocked(updateProductStatus).mockResolvedValue({
      ...product,
      status: 'INACTIVE',
    });
    render(
      <ProductProfile organizationId={organizationId} productId={product.id} />,
    );
    await screen.findByText('PHP 850.00');
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Branch prices, quantities, and movement history are preserved',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(updateProductStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(dialog.querySelectorAll('button')[1]);
    await waitFor(() =>
      expect(updateProductStatus).toHaveBeenCalledWith(
        request,
        organizationId,
        product.id,
        'INACTIVE',
      ),
    );
    expect(
      await screen.findByText(`${product.name} is now inactive.`),
    ).toBeInTheDocument();
    expect(screen.getByText('PHP 850.00')).toBeInTheDocument();
  });
  it('edits identity in the modal without a merchant selector', async () => {
    vi.mocked(updateProduct).mockResolvedValue({
      ...product,
      name: 'Updated vase',
    });
    render(
      <ProductProfile organizationId={organizationId} productId={product.id} />,
    );
    await screen.findByText('PHP 850.00');
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(
      screen.getByRole('dialog', { name: 'Edit product profile' }),
    ).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Product name' }), {
      target: { value: 'Updated vase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Updated vase was updated successfully.');
    expect(updateProduct).toHaveBeenCalledWith(
      request,
      organizationId,
      product.id,
      { name: 'Updated vase', sku: product.sku, barcode: product.barcode },
    );
  });
  it.each(['CASHIER'])('does not request profiles for %s', (role) => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role },
      organizationStatus: 'ready',
    } as never);
    render(
      <ProductProfile organizationId={organizationId} productId={product.id} />,
    );
    expect(getProduct).not.toHaveBeenCalled();
  });
});
