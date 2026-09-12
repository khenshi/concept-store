import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { updateProduct } from '../api/product-api';
import { ProductForm } from './product-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/product-api', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));
const product = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  merchantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Vase',
  sku: 'VA-01',
  barcode: '001Ab',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};
describe('ProductForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });
  afterEach(() => vi.useRealTimers());
  it('validates each input after debounce and immediately on blur', async () => {
    vi.useFakeTimers();
    render(
      <ProductForm
        organizationId={product.organizationId}
        merchants={[]}
        product={product}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const name = screen.getByRole('textbox', { name: 'Product name' });
    fireEvent.change(name, { target: { value: 'x' } });
    expect(
      screen.queryByText('Name must contain at least 2 characters.'),
    ).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(name, { target: { value: 'Valid' } });
    fireEvent.blur(name);
    expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });
  it('edits only identity and clears optional identifiers', async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ...product, sku: null });
    render(
      <ProductForm
        organizationId={product.organizationId}
        merchants={[]}
        product={product}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'SKU (optional)' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith(
        request,
        product.organizationId,
        product.id,
        { name: 'Vase', sku: null, barcode: '001Ab' },
      ),
    );
  });
  it('disables creation with no active merchants', () => {
    render(
      <ProductForm
        organizationId={product.organizationId}
        merchants={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Create product' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Add or activate a merchant before creating a product.'),
    ).toBeInTheDocument();
  });
  it('blocks dismissal controls and repeated writes while pending', async () => {
    vi.mocked(updateProduct).mockReturnValue(new Promise(() => {}));
    render(
      <ProductForm
        organizationId={product.organizationId}
        merchants={[]}
        product={product}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Product name' }),
    ).toBeDisabled();
    expect(updateProduct).toHaveBeenCalledTimes(1);
  });
});
