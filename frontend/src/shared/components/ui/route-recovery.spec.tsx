import { fireEvent, render, screen } from '@testing-library/react';
import { RouteRecovery } from './route-recovery';

describe('RouteRecovery', () => {
  it('provides a safe retry and navigation destination', () => {
    const onRetry = vi.fn();

    render(
      <RouteRecovery
        title="This workspace could not be loaded"
        description="Try again or return to your organization list."
        onRetry={onRetry}
        primaryHref="/app"
        primaryLabel="Back to organizations"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'This workspace could not be loaded',
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('link', { name: 'Back to organizations' }),
    ).toHaveAttribute('href', '/app');
  });

  it('does not render a retry action when the route is not found', () => {
    render(
      <RouteRecovery
        title="Page not found"
        description="This page is unavailable."
        primaryHref="/"
        primaryLabel="Back to home"
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
