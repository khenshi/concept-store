import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { createOrganization, listOrganizations } from '../api/organization-api';
import { OrganizationEntry } from './organization-entry';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/organization-api', () => ({
  createOrganization: vi.fn(),
  listOrganizations: vi.fn(),
}));

describe('OrganizationEntry', () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'user-id', email: 'owner@example.com' },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: 'north-pine-id',
        name: 'North & Pine',
        role: 'OWNER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'harbor-id',
        name: 'Harbor Collective',
        role: 'MANAGER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  it('filters organizations by name', async () => {
    render(<OrganizationEntry />);
    expect(await screen.findByText('North & Pine')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search organizations'), {
      target: { value: 'harbor' },
    });

    expect(screen.getByText('Harbor Collective')).toBeInTheDocument();
    expect(screen.queryByText('North & Pine')).not.toBeInTheDocument();
  });

  it('keeps row padding inside the link so hover fills the panel width', async () => {
    render(<OrganizationEntry />);
    const row = await screen.findByRole('link', { name: /North & Pine/ });
    expect(row).toHaveClass('w-full', 'px-5', 'sm:px-6', 'hover:bg-subtle');
    expect(row.closest('ul')).toHaveClass('p-0');
    expect(row.closest('ul')?.parentElement).not.toHaveClass('px-5', 'sm:px-6');
  });

  it('creates an organization from the dialog and opens its overview', async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: 'new-organization-id',
      name: 'New Store',
      role: 'OWNER',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    });
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');

    fireEvent.click(
      screen.getByRole('button', { name: 'Create organization' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Organization name'), {
      target: { value: 'New Store' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create organization' }),
    );

    await waitFor(() =>
      expect(createOrganization).toHaveBeenCalledWith(
        expect.any(Function),
        'New Store',
      ),
    );
    expect(push).toHaveBeenCalledWith('/app/organizations/new-organization-id');
  });

  it('validates the organization name and focuses the invalid field', async () => {
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');
    fireEvent.click(
      screen.getByRole('button', { name: 'Create organization' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(
      'Give your concept-store business a name. You will become its first owner.',
    );
    const field = within(dialog).getByLabelText('Organization name');
    expect(field).toHaveFocus();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create organization' }),
    );
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveFocus();
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it('keeps failed creation open with error feedback and supports closing', async () => {
    vi.mocked(createOrganization).mockRejectedValue(new Error('Unavailable'));
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');
    const trigger = screen.getByRole('button', { name: 'Create organization' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Organization name'), {
      target: { value: 'New Store' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create organization' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The request could not be completed.',
    );
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Close create organization dialog',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('provides distinct empty and filtered-empty states', async () => {
    vi.mocked(listOrganizations).mockResolvedValueOnce([]);
    const { unmount } = render(<OrganizationEntry />);
    expect(
      await screen.findByText('Your first workspace starts here'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create your first organization' }),
    ).toBeInTheDocument();
    unmount();
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');
    fireEvent.change(screen.getByLabelText('Search organizations'), {
      target: { value: 'No match' },
    });
    expect(screen.getByText('No organizations found')).toBeInTheDocument();
  });

  it('prevents repeated creation and unsafe dismissal while a request is pending', async () => {
    let finish!: (
      organization: Awaited<ReturnType<typeof createOrganization>>,
    ) => void;
    vi.mocked(createOrganization).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');
    fireEvent.click(
      screen.getByRole('button', { name: 'Create organization' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Organization name'), {
      target: { value: 'New Store' },
    });
    const form = within(dialog).getByRole('form', {
      name: 'Create organization',
    });
    fireEvent.submit(form);
    expect(
      within(dialog).getByRole('button', { name: 'Creating organization…' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(
      within(dialog).getByRole('button', {
        name: 'Close create organization dialog',
      }),
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(createOrganization).toHaveBeenCalledOnce();
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await act(async () =>
      finish({
        id: 'new-id',
        name: 'New Store',
        role: 'OWNER',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }),
    );
    expect(push).toHaveBeenCalledWith('/app/organizations/new-id');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recovers the organization list after a request failure', async () => {
    vi.mocked(listOrganizations).mockRejectedValueOnce(
      new Error('Unavailable'),
    );
    render(<OrganizationEntry />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The request could not be completed.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('North & Pine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
