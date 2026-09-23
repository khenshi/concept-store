import { render } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ThemedWorkspace } from './themed-workspace';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('./authenticated-header', () => ({ AuthenticatedHeader: () => null }));

it('applies the account theme to the document and clears it on route exit', () => {
  vi.mocked(useAuth).mockReturnValue({
    colorTheme: 'CORONA_DARK',
  } as ReturnType<typeof useAuth>);
  const { unmount } = render(<ThemedWorkspace>Workspace</ThemedWorkspace>);
  expect(document.documentElement.dataset.colorTheme).toBe('CORONA_DARK');
  unmount();
  expect(document.documentElement.dataset.colorTheme).toBeUndefined();
});
