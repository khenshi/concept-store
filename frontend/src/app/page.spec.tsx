import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('identifies the shared application areas', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: 'Run your concept store in one place.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Store operations')).toBeInTheDocument();
    expect(screen.getByText('Merchant portal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
