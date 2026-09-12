import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { listOrganizations } from '../api/organization-api';
import { OrganizationSwitcher } from './organization-switcher';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/organization-api', () => ({ listOrganizations: vi.fn() }));

describe('OrganizationSwitcher', () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: 'current-id',
        name: 'North & Pine',
        role: 'OWNER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'another-id',
        name: 'Harbor Collective',
        role: 'MANAGER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  it('switches organizations and returns to the organization list', async () => {
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
      />,
    );
    const trigger = await screen.findByRole('button', { name: /North & Pine/ });
    fireEvent.click(trigger);

    fireEvent.click(
      await screen.findByRole('menuitem', { name: /Harbor Collective/ }),
    );
    expect(push).toHaveBeenCalledWith('/app/organizations/another-id');

    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'All organizations' }),
    );
    expect(push).toHaveBeenCalledWith('/app');
  });

  it('supports keyboard navigation and restores trigger focus on Escape', async () => {
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
        collapsed
      />,
    );
    const trigger = await screen.findByRole('button', {
      name: /Switch organization: North & Pine/,
    });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const first = await screen.findByRole('menuitem', { name: /North & Pine/ });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(
      screen.getByRole('menuitem', { name: /Harbor Collective/ }),
    ).toHaveFocus();
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: /Harbor Collective/ }),
      { key: 'End' },
    );
    const all = screen.getByRole('menuitem', { name: 'All organizations' });
    expect(all).toHaveFocus();
    fireEvent.keyDown(all, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on a second trigger click even when pointer focus emits a null blur target', async () => {
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
      />,
    );
    const trigger = await screen.findByRole('button', {
      name: /Switch organization: North & Pine/,
    });
    fireEvent.click(trigger);
    const item = await screen.findByRole('menuitem', { name: /North & Pine/ });
    fireEvent.pointerDown(trigger);
    fireEvent.blur(item, { relatedTarget: null });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('still dismisses on an outside pointer click and keyboard Tab', async () => {
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
      />,
    );
    const trigger = await screen.findByRole('button', {
      name: /Switch organization: North & Pine/,
    });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /North & Pine/ }), {
      key: 'Tab',
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('gives concurrently mounted switchers unique popup IDs', async () => {
    render(
      <>
        <OrganizationSwitcher organizationId="current-id" compact />
        <OrganizationSwitcher organizationId="current-id" collapsed />
      </>,
    );
    const triggers = await screen.findAllByRole('button', {
      name: /Switch organization: North & Pine/,
    });
    expect(triggers).toHaveLength(2);
    expect(triggers[0].getAttribute('aria-controls')).not.toBe(
      triggers[1].getAttribute('aria-controls'),
    );
  });

  it('recovers the organization list after a failed request', async () => {
    vi.mocked(listOrganizations).mockRejectedValueOnce(
      new Error('Unavailable'),
    );
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry organization list' }),
    );
    await screen.findByRole('button', {
      name: /Switch organization: North & Pine/,
    });
    expect(await screen.findByText('Organization')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Switch organization: North & Pine/ }),
    );
    expect(
      await screen.findByRole('menuitem', { name: /Harbor Collective/ }),
    ).toBeInTheDocument();
  });
});
