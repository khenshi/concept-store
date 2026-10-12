import { render, screen } from '@testing-library/react';
import { PageHeader, usePageHeaderRequestError } from './page-header';

function BranchSelectorError({ onRetry }: { onRetry(): void }) {
  usePageHeaderRequestError('Branches could not be loaded.', onRetry);
  return <div>Branch selector</div>;
}

describe('PageHeader', () => {
  it('places selector errors in a full-width row below the header content', async () => {
    const onRetry = vi.fn();

    render(
      <PageHeader
        title="Inventory"
        description="Manage stock by branch."
        action={<BranchSelectorError onRetry={onRetry} />}
      />,
    );

    const error = await screen.findByRole('alert');

    expect(error).toHaveClass('col-span-full', 'w-full');
    expect(error.closest('header')).toHaveClass('grid');
    expect(error).toHaveTextContent('Branches could not be loaded.');
  });
});
