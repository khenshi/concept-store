import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('presents the platform and primary account actions', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: 'Run your store with everything in its place.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Keep every location in view',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Give every person the right context',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.getAllByRole('link', { name: 'Create your workspace' })[0],
    ).toHaveAttribute('href', '/register');
  });
});
