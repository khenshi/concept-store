import { fireEvent, render, screen } from '@testing-library/react';
import { ListSkeleton } from './list-skeleton';
import { RequestError } from './request-error';

describe('shared request states', () => {
  it('announces a loading list without exposing decorative rows', () => {
    render(<ListSkeleton label="Loading organizations" rows={2} />);

    expect(
      screen.getByRole('status', { name: 'Loading organizations' }),
    ).toBeInTheDocument();
  });

  it('presents an error and retries on request', () => {
    const onRetry = vi.fn();
    render(
      <RequestError
        title="Organizations unavailable"
        message="Please try again."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Organizations unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
