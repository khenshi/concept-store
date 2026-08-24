import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('presents the platform and primary account actions', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: 'Run your concept store with one clear system.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Every role sees what matters to them.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.getByRole('link', { name: 'Create your workspace' }),
    ).toHaveAttribute('href', '/register');
  });
});
