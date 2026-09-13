import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import {
  listMemberBranches,
  loadMemberAccessOptions,
  setMemberBranch,
  setMemberMerchant,
  updateOrganizationMemberRole,
} from '../api/organization-member-api';
import { MemberAccessDialog } from './member-access-dialog';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/organization-member-api', () => ({
  listMemberBranches: vi.fn(),
  loadMemberAccessOptions: vi.fn(),
  setMemberBranch: vi.fn(),
  setMemberMerchant: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
}));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branch = { id, name: 'Makati', code: 'MKT' };
const member = {
  id,
  email: 'member@example.test',
  firstName: 'Test',
  lastName: 'Member',
  phone: null,
  role: 'MANAGER' as const,
  merchantId: null,
  joinedAt: '2026-09-13T00:00:00Z',
};
const request = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ request } as never);
  vi.mocked(loadMemberAccessOptions).mockResolvedValue({
    branches: [branch],
    merchants: [{ id, name: 'Amihan', code: null, status: 'ACTIVE' }],
  });
  vi.mocked(listMemberBranches).mockResolvedValue([branch]);
});

it('confirms revocation and preserves access on cancellation', async () => {
  render(
    <MemberAccessDialog
      organizationId="org"
      member={member}
      onClose={vi.fn()}
      onMemberChanged={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke Makati' }));
  expect(
    screen.getByRole('button', { name: 'Keep current access' }),
  ).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Keep current access' }));
  expect(setMemberBranch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke Makati' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await screen.findByRole('button', { name: 'Grant Makati' });
  expect(setMemberBranch).toHaveBeenCalledWith(request, 'org', id, id, false);
});

it('blocks dismissal and repeat writes while a grant is pending', async () => {
  vi.mocked(listMemberBranches).mockResolvedValue([]);
  let resolve!: () => void;
  vi.mocked(setMemberBranch).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onClose = vi.fn();
  render(
    <MemberAccessDialog
      organizationId="org"
      member={member}
      onClose={onClose}
      onMemberChanged={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Grant Makati' }));
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true }),
  );
  expect(onClose).not.toHaveBeenCalled();
  resolve();
  await screen.findByRole('button', { name: 'Revoke Makati' });
  expect(setMemberBranch).toHaveBeenCalledTimes(1);
});

it('requires merchant selection and submits a confirmed merchant role change', async () => {
  const onMemberChanged = vi.fn();
  vi.mocked(updateOrganizationMemberRole).mockResolvedValue({
    ...member,
    role: 'MERCHANT',
    merchantId: id,
  });
  render(
    <MemberAccessDialog
      organizationId="org"
      member={member}
      changeToMerchant
      onClose={vi.fn()}
      onMemberChanged={onMemberChanged}
    />,
  );
  expect(
    await screen.findByRole('button', { name: 'Review role change' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('combobox', { name: 'Merchant profile' }));
  fireEvent.click(screen.getByRole('option', { name: 'Amihan · ACTIVE' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review role change' }));
  expect(
    screen.getByText(/Existing branch assignments will be cleared/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await waitFor(() => expect(onMemberChanged).toHaveBeenCalled());
  expect(updateOrganizationMemberRole).toHaveBeenCalledWith(
    request,
    'org',
    id,
    'MERCHANT',
    id,
  );
});

it('preserves a failed relink confirmation and offers retry', async () => {
  vi.mocked(setMemberMerchant).mockRejectedValue(
    new Error('Membership changed concurrently'),
  );
  render(
    <MemberAccessDialog
      organizationId="org"
      member={{ ...member, role: 'MERCHANT' }}
      onClose={vi.fn()}
      onMemberChanged={vi.fn()}
    />,
  );
  await screen.findByRole('combobox', { name: 'Merchant profile' });
  fireEvent.click(screen.getByRole('combobox', { name: 'Merchant profile' }));
  fireEvent.click(screen.getByRole('option', { name: 'Amihan · ACTIVE' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review merchant link' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Membership changed concurrently',
  );
  expect(screen.getByRole('button', { name: 'Confirm change' })).toBeEnabled();
});
