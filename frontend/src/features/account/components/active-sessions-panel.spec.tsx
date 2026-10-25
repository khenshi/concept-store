import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { ActiveSessionsPanel } from './active-sessions-panel';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
const listSessions = vi.fn();
const revokeSession = vi.fn();
const current = {
  id: '00000000-0000-4000-8000-000000000001',
  isCurrent: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  expiresAt: '2026-11-01T00:00:00.000Z',
};
const other = {
  ...current,
  id: '00000000-0000-4000-8000-000000000002',
  isCurrent: false,
};
const page = {
  items: [current, other],
  page: 1,
  pageSize: 15,
  total: 2,
  totalPages: 1,
};

describe('ActiveSessionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSessions.mockResolvedValue(page);
    revokeSession.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      listSessions,
      revokeSession,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('loads safe metadata, identifies the current session, and confirms only one selected sign-out', async () => {
    render(<ActiveSessionsPanel />);
    expect(
      screen.getByRole('status', { name: 'Loading active sessions' }),
    ).toBeInTheDocument();
    const trigger = await screen.findByRole('button', {
      name: 'Sign out session 2',
    });
    expect(screen.getByText('Current session')).toBeInTheDocument();
    expect(screen.queryByText(current.id)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/last active|device|ip address/i),
    ).not.toBeInTheDocument();
    trigger.focus();
    fireEvent.click(trigger);
    let dialog = screen.getByRole('alertdialog');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
    expect(revokeSession).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    dialog = screen.getByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out session' }),
    );
    await waitFor(() =>
      expect(revokeSession).toHaveBeenCalledWith(other.id, false),
    );
    expect(
      await screen.findByText('The selected session has been signed out.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole('group', { name: 'Session management' }),
    ).toHaveFocus();
  });

  it('warns before current-session sign-out and delegates local session clearing', async () => {
    render(<ActiveSessionsPanel />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign out current session' }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: 'Sign out of this session?',
    });
    expect(dialog).toHaveTextContent('Finish any work in progress');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out session' }),
    );
    await waitFor(() =>
      expect(revokeSession).toHaveBeenCalledWith(current.id, true),
    );
    expect(listSessions).toHaveBeenCalledOnce();
  });

  it('shows load errors with explicit retry and an empty result', async () => {
    listSessions
      .mockRejectedValueOnce(new ApiError(503, 'Temporarily unavailable.'))
      .mockResolvedValueOnce({ ...page, items: [], total: 0, totalPages: 0 });
    render(<ActiveSessionsPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Temporarily unavailable.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(/No active sessions to display/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Active sessions pagination' }),
    ).toBeInTheDocument();
  });

  it('protects pending confirmation and retains failed revocation for an explicit retry', async () => {
    let reject!: (cause: unknown) => void;
    revokeSession.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(<ActiveSessionsPanel />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign out session 2' }),
    );
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out session' }),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Signing out…' }),
    );
    expect(revokeSession).toHaveBeenCalledOnce();
    await act(async () =>
      reject(new ApiError(503, 'Temporarily unavailable.')),
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Temporarily unavailable.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Sign out session' }),
    ).toBeEnabled();
    expect(listSessions).toHaveBeenCalledOnce();
  });

  it('requests the next page and returns to the last page after a shrinking result', async () => {
    listSessions
      .mockResolvedValueOnce({ ...page, total: 16, totalPages: 2 })
      .mockResolvedValueOnce({
        ...page,
        items: [],
        page: 2,
        total: 15,
        totalPages: 1,
      })
      .mockResolvedValueOnce(page);
    render(<ActiveSessionsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listSessions.mock.calls.map(([value]) => value)).toEqual([
        1, 2, 1,
      ]),
    );
    await screen.findByRole('button', { name: 'Sign out current session' });
  });
});
