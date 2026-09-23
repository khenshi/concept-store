import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ColorThemePicker } from './color-theme-picker';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));

const updateColorTheme = vi.fn();

describe('ColorThemePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { colorTheme: 'GRAPHITE' },
      colorTheme: 'GRAPHITE',
      updateColorTheme,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('shows the current choice and saves a new theme once', async () => {
    let resolve!: () => void;
    updateColorTheme.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render(<ColorThemePicker />);

    expect(screen.getByRole('radio', { name: 'Graphite' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Ocean' }));
    expect(updateColorTheme).toHaveBeenCalledWith('OCEAN');
    expect(screen.getByRole('radio', { name: 'Forest' })).toBeDisabled();
    resolve();
    expect(
      await screen.findByText('Your color theme has been saved.'),
    ).toBeInTheDocument();
    expect(updateColorTheme).toHaveBeenCalledOnce();
  });

  it('shows a retryable error when saving fails', async () => {
    updateColorTheme.mockRejectedValueOnce(new Error('Unavailable'));
    render(<ColorThemePicker />);

    fireEvent.click(screen.getByRole('radio', { name: 'Plum' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your color theme could not be saved. Please try again.',
    );
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Plum' })).not.toBeDisabled(),
    );
  });
});
