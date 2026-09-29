import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useWorkspaceChrome } from './workspace-chrome-context';
import { ThemedWorkspace } from './themed-workspace';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('./authenticated-header', () => ({
  AuthenticatedHeader: () => <header>Authenticated app header</header>,
}));

function ChromeToggle() {
  const { posFullscreen, enterPosFullscreen, exitPosFullscreen } =
    useWorkspaceChrome();
  return (
    <button onClick={posFullscreen ? exitPosFullscreen : enterPosFullscreen}>
      {posFullscreen ? 'Exit POS mode' : 'Enter POS mode'}
    </button>
  );
}

it('applies the account theme to the document and clears it on route exit', () => {
  vi.mocked(useAuth).mockReturnValue({
    colorTheme: 'CORONA_DARK',
  } as ReturnType<typeof useAuth>);
  const { unmount } = render(<ThemedWorkspace>Workspace</ThemedWorkspace>);
  expect(document.documentElement.dataset.colorTheme).toBe('CORONA_DARK');
  unmount();
  expect(document.documentElement.dataset.colorTheme).toBeUndefined();
});

it('hides authenticated chrome in POS full-screen mode and restores it on exit', () => {
  vi.mocked(useAuth).mockReturnValue({
    colorTheme: 'CORONA_DARK',
  } as ReturnType<typeof useAuth>);
  render(
    <ThemedWorkspace>
      <ChromeToggle />
    </ThemedWorkspace>,
  );

  expect(screen.getByText('Authenticated app header')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Enter POS mode' }));
  expect(
    screen.queryByText('Authenticated app header'),
  ).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');

  fireEvent.click(screen.getByRole('button', { name: 'Exit POS mode' }));
  expect(screen.getByText('Authenticated app header')).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
});
