import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';
import { OrganizationWorkspaceShell } from './organization-workspace-shell';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('./organization-workspace-context', () => ({
  useOrganizationWorkspaceContext: vi.fn(),
}));
vi.mock('./organization-switcher', () => ({
  OrganizationSwitcher: ({ collapsed }: { collapsed?: boolean }) => (
    <button>
      {collapsed ? 'Compact organization switcher' : 'Organization switcher'}
    </button>
  ),
}));

const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
const desktop = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
const preferences = new Map<string, string>();
const storage = {
  getItem: vi.fn<(key: string) => string | null>(),
  setItem: vi.fn<(key: string, value: string) => void>(),
};

function context(role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'MERCHANT') {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', name: 'North & Pine', role },
    organizationStatus: 'ready',
  } as ReturnType<typeof useOrganizationWorkspaceContext>);
}

function renderShell() {
  return render(
    <OrganizationWorkspaceShell organizationId="org">
      <h1>Workspace content</h1>
    </OrganizationWorkspaceShell>,
  );
}

describe('OrganizationWorkspaceShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.clear();
    storage.getItem.mockImplementation((key) => preferences.get(key) ?? null);
    storage.setItem.mockImplementation((key, value) => {
      preferences.set(key, value);
    });
    vi.stubGlobal('localStorage', storage);
    desktop.matches = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => desktop),
    );
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
    vi.mocked(usePathname).mockReturnValue('/app/organizations/org');
    context('OWNER');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalShow)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        'showModal',
        originalShow,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    if (originalClose)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        'close',
        originalClose,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'preserves management destinations for %s',
    (role) => {
      context(role);
      renderShell();
      const sidebar = within(
        screen.getByRole('complementary', { name: 'Workspace sidebar' }),
      );
      if (role === 'OWNER')
        expect(
          sidebar.getByRole('link', { name: 'Members' }),
        ).toBeInTheDocument();
      else
        expect(
          sidebar.queryByRole('link', { name: 'Members' }),
        ).not.toBeInTheDocument();
      expect(
        sidebar.getByRole('link', { name: 'Merchants' }),
      ).toBeInTheDocument();
      if (role === 'MERCHANT')
        expect(sidebar.getByRole('link', { name: 'Sales' })).toHaveAttribute(
          'href',
          '/app/organizations/org/sales',
        );
      else
        expect(
          sidebar.queryByRole('link', { name: 'Sales' }),
        ).not.toBeInTheDocument();
    },
  );

  it.each(['CASHIER'] as const)(
    'keeps management destinations hidden for %s',
    (role) => {
      context(role);
      renderShell();
      expect(
        screen.queryByRole('link', { name: 'Members' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Merchants' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Branches' }),
      ).toBeInTheDocument();
    },
  );

  it.each(['OWNER', 'MANAGER', 'MERCHANT', 'CASHIER'] as const)(
    'exposes staff Reports in sidebar and mobile navigation only for staff: %s',
    (role) => {
      context(role);
      vi.mocked(usePathname).mockReturnValue(
        '/app/organizations/org/branches/branch/reports',
      );
      renderShell();
      const sidebar = within(
        screen.getByRole('complementary', { name: 'Workspace sidebar' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const mobile = within(
        screen.getByRole('dialog', { name: 'Workspace navigation' }),
      );
      for (const region of [sidebar, mobile]) {
        if (role === 'OWNER' || role === 'MANAGER') {
          expect(region.getByRole('link', { name: 'Reports' })).toHaveAttribute(
            'href',
            '/app/organizations/org/reports',
          );
          expect(region.getByRole('link', { name: 'Reports' })).toHaveAttribute(
            'aria-current',
            'page',
          );
          expect(
            region.getByRole('link', { name: 'Branches' }),
          ).not.toHaveAttribute('aria-current');
        } else
          expect(
            region.queryByRole('link', { name: 'Reports' }),
          ).not.toBeInTheDocument();
      }
    },
  );

  it('restores and updates sidebar preference while keeping organization switching available', async () => {
    window.localStorage.setItem('kapwesto.sidebar.collapsed', 'true');
    renderShell();
    const expand = await screen.findByRole('button', {
      name: 'Expand sidebar',
    });
    expect(
      screen.getByRole('button', { name: 'Compact organization switcher' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'title',
      'Overview',
    );
    fireEvent.click(expand);
    expect(window.localStorage.getItem('kapwesto.sidebar.collapsed')).toBe(
      'false',
    );
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeInTheDocument();
  });

  it('opens and dismisses the mobile dialog with safe focus and scroll restoration', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Menu' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Workspace navigation' });
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(dialog).getByRole('button', { name: 'Close navigation' }),
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('dismisses on navigation, close action, and transition to desktop', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    const branches = within(screen.getByRole('dialog')).getByRole('link', {
      name: 'Branches',
    });
    branches.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(branches);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    desktop.matches = true;
    const handler = desktop.addEventListener.mock.calls.at(
      -1,
    )?.[1] as () => void;
    act(() => handler());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('continues working when browser preference storage is blocked', async () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    storage.setItem.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Expand sidebar' }),
      ).toBeInTheDocument(),
    );
  });
});
