import { fireEvent, render, screen } from '@testing-library/react';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';
import { OrganizationWorkspace } from './organization-workspace';

vi.mock('./organization-workspace-context', () => ({
  useOrganizationWorkspaceContext: vi.fn(),
}));
const refreshOrganization = vi.fn(async () => {});
function context(
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'MERCHANT',
  status: 'ready' | 'loading' | 'error' = 'ready',
) {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organizationId: 'org',
    organization:
      status === 'ready'
        ? {
            id: 'org',
            name: 'North & Pine',
            role,
            createdAt: '2026-09-12T00:00:00.000Z',
            updatedAt: '2026-09-12T00:00:00.000Z',
          }
        : null,
    organizationStatus: status,
    organizationError: 'Workspace unavailable',
    refreshOrganization,
    selectedBranchId: null,
    setSelectedBranchId: vi.fn(),
    branches: [],
    branchesStatus: 'idle',
    branchesError: null,
    loadBranches: vi.fn(async () => []),
    upsertBranch: vi.fn(),
  });
}

describe('OrganizationWorkspace', () => {
  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'exposes only existing management workflows for %s',
    (role) => {
      context(role);
      render(<OrganizationWorkspace organizationId="org" />);
      expect(
        screen.getByText(
          `${role.charAt(0) + role.slice(1).toLowerCase()} access`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Branch operations' }),
      ).toBeInTheDocument();
      expect(
        screen
          .getByRole('heading', { name: 'Branch operations' })
          .closest('section'),
      ).toHaveClass('rounded-panel', 'border-hairline', 'bg-surface');
      expect(screen.getByRole('link', { name: /Reports/ })).toHaveAttribute(
        'href',
        '/app/organizations/org/reports',
      );
      expect(screen.getByRole('link', { name: /Inventory/ })).toHaveAttribute(
        'href',
        '/app/organizations/org/inventory',
      );
      expect(screen.getByRole('link', { name: /Spaces/ })).toHaveAttribute(
        'href',
        '/app/organizations/org/spaces',
      );
      if (role === 'MERCHANT') {
        expect(
          screen.queryByRole('link', { name: /^POS/ }),
        ).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole('link', { name: /^POS/ })).toHaveAttribute(
          'href',
          '/app/organizations/org/pos',
        );
      }
      expect(screen.getByRole('link', { name: /Merchants/ })).toHaveAttribute(
        'href',
        '/app/organizations/org/merchants',
      );
      if (role === 'OWNER')
        expect(
          screen.getByRole('link', { name: /Members/ }),
        ).toBeInTheDocument();
      else
        expect(
          screen.queryByRole('link', { name: /Members/ }),
        ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Products/ }),
      ).toBeInTheDocument();
      if (role === 'MERCHANT')
        expect(screen.getByRole('link', { name: /^Sales/ })).toHaveAttribute(
          'href',
          '/app/organizations/org/sales',
        );
      else
        expect(
          screen.queryByRole('link', { name: /^Sales/ }),
        ).not.toBeInTheDocument();
    },
  );
  it('uses the shared canvas around the overview content', () => {
    context('OWNER');
    render(<OrganizationWorkspace organizationId="org" />);
    const overviewSection = screen
      .getByRole('heading', { name: 'Workspace overview' })
      .closest('section');
    expect(overviewSection?.parentElement).toHaveClass('bg-canvas');
  });
  it.each(['CASHIER'] as const)(
    'preserves restricted-role visibility for %s',
    (role) => {
      context(role);
      render(<OrganizationWorkspace organizationId="org" />);
      expect(screen.getByText('Cashier access')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Merchants/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Members/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Branches/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Account settings/ }),
      ).toHaveAttribute('href', '/app/account');
      expect(screen.getByRole('link', { name: /^POS/ })).toHaveAttribute(
        'href',
        '/app/organizations/org/pos',
      );
      expect(
        screen.queryByRole('link', { name: /Reports/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Inventory/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Spaces/ }),
      ).not.toBeInTheDocument();
    },
  );
  it('announces loading and provides unavailable-workspace recovery', () => {
    context('OWNER', 'loading');
    const { rerender } = render(<OrganizationWorkspace organizationId="org" />);
    expect(
      screen.getByRole('status', { name: 'Loading organization workspace' }),
    ).toBeInTheDocument();
    context('OWNER', 'error');
    rerender(<OrganizationWorkspace organizationId="org" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Workspace unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refreshOrganization).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('link', { name: 'Choose another organization' }),
    ).toHaveAttribute('href', '/app');
  });
});
