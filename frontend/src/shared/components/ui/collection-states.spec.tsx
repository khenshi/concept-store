import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './empty-state';
import { PaginationControls } from './pagination-controls';

describe('collection state controls', () => {
  it('renders the centered empty warning with its description and action', () => {
    render(
      <EmptyState
        title="No records yet"
        description="Records will appear here after the first completed action."
        action={<button type="button">Create record</button>}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('No records yet');
    expect(screen.getByText(/Records will appear here/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create record' }),
    ).toBeInTheDocument();
  });

  it('uses arrow controls with the page indicator between them', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <PaginationControls
        ariaLabel="Records pagination"
        currentPage={2}
        totalPages={5}
        summary="42 records"
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    expect(screen.getByLabelText('Page 2/5')).toHaveTextContent('2/5');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });
});
