import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { createOrganizationInvitation } from '../api/organization-invitation-api';
import { OrganizationInvitationModal } from './organization-invitation-modal';
import { loadMemberAccessOptions } from '@/features/organization-members/api/organization-member-api';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/organization-members/api/organization-member-api', () => ({
  loadMemberAccessOptions: vi
    .fn()
    .mockResolvedValue({ branches: [], merchants: [] }),
}));
vi.mock('../api/organization-invitation-api', () => ({
  createOrganizationInvitation: vi.fn(),
}));
const request = vi.fn();
const show = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const close = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadMemberAccessOptions).mockResolvedValue({
    branches: [],
    merchants: [],
  });
  vi.mocked(useAuth).mockReturnValue({ request } as unknown as ReturnType<
    typeof useAuth
  >);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});

it('validates email after input debounce and immediately on blur', async () => {
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'invalid' },
  });
  expect(
    screen.queryByText('Enter a valid email address.'),
  ).not.toBeInTheDocument();
  expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'valid@example.test' },
  });
  fireEvent.blur(screen.getByLabelText('Email address'));
  await waitFor(() =>
    expect(
      screen.queryByText('Enter a valid email address.'),
    ).not.toBeInTheDocument(),
  );
});

it('includes selected branch and merchant grants on merchant invitations', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  vi.mocked(loadMemberAccessOptions).mockResolvedValue({
    branches: [{ id, name: 'Makati', code: null }],
    merchants: [{ id, name: 'Amihan', code: null, status: 'ACTIVE' }],
  });
  vi.mocked(createOrganizationInvitation).mockResolvedValue({
    token: 'token',
    invitation: {
      id,
      organizationId: id,
      email: 'merchant@example.test',
      role: 'MERCHANT',
      expiresAt: '2026-09-20T00:00:00Z',
      createdAt: '2026-09-13T00:00:00Z',
      acceptedAt: null,
      revokedAt: null,
    },
  });
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await screen.findByLabelText('Makati');
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'merchant@example.test' },
  });
  fireEvent.click(screen.getByRole('combobox', { name: 'Organization role' }));
  fireEvent.click(screen.getByRole('option', { name: 'Merchant' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Merchant profile' }));
  fireEvent.click(screen.getByRole('option', { name: 'Amihan · ACTIVE' }));
  fireEvent.click(screen.getByLabelText('Makati'));
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  await screen.findByRole('heading', { name: 'Invitation ready' });
  expect(createOrganizationInvitation).toHaveBeenCalledWith(request, 'org', {
    email: 'merchant@example.test',
    role: 'MERCHANT',
    branchIds: [id],
    merchantId: id,
  });
});

it('requires a merchant link before submitting a merchant invitation', async () => {
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText(
    'No branches available. Access can be assigned later.',
  );
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'merchant@example.test' },
  });
  fireEvent.click(screen.getByRole('combobox', { name: 'Organization role' }));
  fireEvent.click(screen.getByRole('option', { name: 'Merchant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  expect(createOrganizationInvitation).not.toHaveBeenCalled();
  expect(
    screen.getByRole('combobox', { name: 'Merchant profile' }),
  ).toHaveAttribute('aria-invalid', 'true');
});

it('recovers choice loading without losing the invitation draft', async () => {
  vi.mocked(loadMemberAccessOptions).mockRejectedValueOnce(
    new Error('offline'),
  );
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'staff@example.test' },
  });
  await screen.findByText(
    'Branches and merchants could not be loaded. Try again.',
  );
  expect(
    screen.getByRole('button', { name: 'Create invitation' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText(
    'No branches available. Access can be assigned later.',
  );
  expect(screen.getByLabelText('Email address')).toHaveValue(
    'staff@example.test',
  );
  expect(createOrganizationInvitation).not.toHaveBeenCalled();
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of [
    ['showModal', show],
    ['close', close],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

it('opens with heading focus and restores focus and scrolling on unmount', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Invite a member' }),
  ).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
  trigger.remove();
});

it('rejects invalid email without making a request', async () => {
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
  expect(createOrganizationInvitation).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getByLabelText('Email address')).toHaveFocus(),
  );
});

it('blocks dismissal while creating and presents the normalized invitation link', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof createOrganizationInvitation>>,
  ) => void;
  vi.mocked(createOrganizationInvitation).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <OrganizationInvitationModal
      organizationId="org"
      onCreated={onCreated}
      onClose={onClose}
    />,
  );
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: ' PERSON@EXAMPLE.COM ' },
  });
  await waitFor(() =>
    expect(
      screen.queryByText('Loading access choices…'),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true }),
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(createOrganizationInvitation).toHaveBeenCalledWith(request, 'org', {
    email: 'person@example.com',
    role: 'CASHIER',
  });
  resolve({
    token: 'single-use-token',
    invitation: {
      id: 'invite',
      organizationId: 'org',
      email: 'person@example.com',
      role: 'CASHIER',
      expiresAt: '2026-09-19T00:00:00Z',
      createdAt: '2026-09-12T00:00:00Z',
      acceptedAt: null,
      revokedAt: null,
    },
  });
  expect(
    await screen.findByRole('heading', { name: 'Invitation ready' }),
  ).toHaveFocus();
  expect(screen.getByLabelText('Invitation link')).toHaveValue(
    `${window.location.origin}/invitations/single-use-token`,
  );
  expect(onCreated).toHaveBeenCalledOnce();
});
