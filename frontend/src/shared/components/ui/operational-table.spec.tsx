import { render, screen } from '@testing-library/react';
import { OperationalTable, OperationalTableFrame } from './operational-table';

describe('OperationalTable', () => {
  it('provides the shared semantic table viewport and base classes', () => {
    render(
      <OperationalTable className="min-w-[40rem]">
        <caption>Inventory table</caption>
        <tbody>
          <tr>
            <td>Placement</td>
          </tr>
        </tbody>
      </OperationalTable>,
    );

    const table = screen.getByRole('table', { name: 'Inventory table' });
    expect(table).toHaveClass('data-table', 'w-full', 'min-w-[40rem]');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });
});

describe('OperationalTableFrame', () => {
  it('keeps the shared empty-state inset and footer slots together', () => {
    render(
      <OperationalTableFrame
        empty={<div role="status">No rows</div>}
        footer={<div>Pagination</div>}
      >
        <div>Rows</div>
      </OperationalTableFrame>,
    );

    expect(screen.getByText('Rows')).toBeInTheDocument();
    expect(screen.getByRole('status').parentElement).toHaveClass(
      'px-5',
      'pb-6',
      'sm:px-6',
    );
    expect(screen.getByText('Pagination')).toBeInTheDocument();
  });
});
