import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('presents the platform and primary account actions', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: 'Start with a clear foundation for your concept store.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Secure organization access',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Team membership' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.getAllByRole('link', { name: 'Create your workspace' })[0],
    ).toHaveAttribute('href', '/register');
  });
});
