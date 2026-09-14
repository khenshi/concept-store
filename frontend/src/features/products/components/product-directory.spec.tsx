import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { listBranches } from '@/features/branches/api/branch-api';
import { createProduct, listProducts } from '../api/product-api';
import {
  merchant,
  organizationId,
  product,
  placement,
} from '../model/product.test-fixtures';
import { ProductDirectory } from './product-directory';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/features/merchants/api/merchant-api', () => ({
  listMerchants: vi.fn(),
}));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('../api/product-api', () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

describe('ProductDirectory workflows', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: organizationId, name: 'Demo Store', role: 'OWNER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(listMerchants).mockResolvedValue([merchant]);
    vi.mocked(listProducts).mockResolvedValue([product]);
    vi.mocked(listBranches).mockResolvedValue([placement.branch]);
  });
  it.each(['CASHIER'])(
    'does not request or show product controls for %s',
    (role) => {
      vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
        organization: { role },
        organizationStatus: 'ready',
      } as never);
      render(<ProductDirectory organizationId={organizationId} />);
      expect(screen.getByRole('alert')).toHaveTextContent(
        'cannot view or manage products',
      );
      expect(listProducts).not.toHaveBeenCalled();
      expect(listMerchants).not.toHaveBeenCalled();
    },
  );
  it('shows a linked product and applies debounced search and filters', async () => {
    render(<ProductDirectory organizationId={organizationId} />);
    expect(
      await screen.findByRole('link', { name: `View ${product.name}` }),
    ).toHaveAttribute(
      'href',
      `/app/organizations/${organizationId}/products/${product.id}`,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: '001Ab' },
    });
    await waitFor(() =>
      expect(listProducts).toHaveBeenLastCalledWith(request, organizationId, {
        q: '001Ab',
        merchantId: undefined,
        status: undefined,
      }),
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(screen.getByRole('option', { name: merchant.name }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    await waitFor(() =>
      expect(listProducts).toHaveBeenLastCalledWith(request, organizationId, {
        q: '001Ab',
        merchantId: merchant.id,
        status: 'INACTIVE',
      }),
    );
  });
  it.each(['MANAGER', 'MERCHANT'])(
    'shows filtered read-only products for %s',
    async (role) => {
      vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
        organization: { role },
        organizationStatus: 'ready',
      } as never);
      render(<ProductDirectory organizationId={organizationId} />);
      await screen.findByRole('link', { name: `View ${product.name}` });
      expect(
        screen.queryByRole('button', { name: 'Add product' }),
      ).not.toBeInTheDocument();
      expect(listMerchants).toHaveBeenCalledWith(
        request,
        organizationId,
        {},
        role,
      );
    },
  );
  it('explains unconfigured merchant access without exposing an empty catalog mutation', async () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MERCHANT' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(listProducts).mockResolvedValue([]);
    vi.mocked(listMerchants).mockResolvedValue([]);
    render(<ProductDirectory organizationId={organizationId} />);
    expect(
      await screen.findByText(/Ask an owner to configure your merchant link/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add product' }),
    ).not.toBeInTheDocument();
  });
  it('retains successful opening creation when the subsequent directory refresh fails, and retries reads only', async () => {
    vi.mocked(createProduct).mockResolvedValue(product);
    vi.mocked(listProducts)
      .mockResolvedValueOnce([product])
      .mockRejectedValueOnce(new Error('Read offline'))
      .mockResolvedValueOnce([product]);
    render(<ProductDirectory organizationId={organizationId} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add product' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    const modal = within(screen.getByRole('dialog'));
    fireEvent.click(modal.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(modal.getByRole('option', { name: merchant.name }));
    fireEvent.change(modal.getByRole('textbox', { name: 'Product name' }), {
      target: { value: 'Vase' },
    });
    fireEvent.click(modal.getByRole('checkbox', { name: 'Add initial stock' }));
    await waitFor(() =>
      expect(
        modal.getByRole('combobox', { name: 'Initial stock branch' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      modal.getByRole('combobox', { name: 'Initial stock branch' }),
    );
    fireEvent.click(modal.getByRole('option', { name: 'Makati · MKT' }));
    fireEvent.change(
      modal.getByRole('textbox', { name: 'Branch selling price (PHP)' }),
      { target: { value: '12.50' } },
    );
    fireEvent.change(
      modal.getByRole('textbox', { name: 'Initial stock quantity' }),
      { target: { value: '3' } },
    );
    fireEvent.click(modal.getByRole('button', { name: 'Create product' }));
    await screen.findByText(
      `${product.name} was created successfully. Initial stock is recorded in the selected branch.`,
    );
    await screen.findByText('The product directory could not be loaded.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: `View ${product.name}` });
    expect(createProduct).toHaveBeenCalledTimes(1);
  });
  it('keeps the dialog open and filters locked during uncertain opening-stock recovery', async () => {
    vi.mocked(createProduct).mockRejectedValue(new Error('Unknown outcome'));
    render(<ProductDirectory organizationId={organizationId} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add product' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    const dialog = screen.getByRole('dialog');
    const modal = within(dialog);
    fireEvent.click(modal.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(modal.getByRole('option', { name: merchant.name }));
    fireEvent.change(modal.getByRole('textbox', { name: 'Product name' }), {
      target: { value: 'Vase' },
    });
    fireEvent.click(modal.getByRole('checkbox', { name: 'Add initial stock' }));
    await waitFor(() =>
      expect(
        modal.getByRole('combobox', { name: 'Initial stock branch' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      modal.getByRole('combobox', { name: 'Initial stock branch' }),
    );
    fireEvent.click(modal.getByRole('option', { name: 'Makati · MKT' }));
    fireEvent.change(
      modal.getByRole('textbox', { name: 'Branch selling price (PHP)' }),
      { target: { value: '12.50' } },
    );
    fireEvent.change(
      modal.getByRole('textbox', { name: 'Initial stock quantity' }),
      { target: { value: '3' } },
    );
    fireEvent.click(modal.getByRole('button', { name: 'Create product' }));
    await modal.findByRole('button', { name: 'Retry same creation' });
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled();
    expect(modal.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(createProduct).toHaveBeenCalledTimes(1);
  });
  it('creates a product in a dialog, announces success, and reloads the list', async () => {
    vi.mocked(createProduct).mockResolvedValue(product);
    render(<ProductDirectory organizationId={organizationId} />);
    await screen.findByText(product.name);
    const trigger = screen.getByRole('button', { name: 'Add product' });
    trigger.focus();
    fireEvent.click(trigger);
    const modal = within(screen.getByRole('dialog', { name: 'Add a product' }));
    fireEvent.click(modal.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(modal.getByRole('option', { name: merchant.name }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Product name' }), {
      target: { value: ' New vase ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'SKU (optional)' }), {
      target: { value: ' va-02 ' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Barcode (optional)' }),
      { target: { value: '001aB' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(request, organizationId, {
        merchantId: merchant.id,
        name: 'New vase',
        sku: 'VA-02',
        barcode: '001aB',
      }),
    );
    expect(
      await screen.findByText(`${product.name} was created successfully.`),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(2));
  });
  it('offers retry after read failure and distinguishes empty results', async () => {
    vi.mocked(listProducts)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([]);
    render(<ProductDirectory organizationId={organizationId} />);
    await screen.findByText('The product directory could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
  });
  it('ignores a superseded response after a filter change', async () => {
    let resolveOld!: (items: (typeof product)[]) => void;
    vi.mocked(listProducts)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValue([]);
    render(<ProductDirectory organizationId={organizationId} />);
    await waitFor(() => expect(listProducts).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    await screen.findByText('No products match these filters');
    await act(async () => resolveOld([product]));
    expect(
      screen.queryByRole('link', { name: `View ${product.name}` }),
    ).not.toBeInTheDocument();
  });
});
