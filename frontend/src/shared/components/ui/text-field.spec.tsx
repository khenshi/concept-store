import { fireEvent, render, screen } from '@testing-library/react';
import { TextField } from './text-field';
import { Notice } from './notice';
import { PageHeader } from './page-header';

describe('shared field and page primitives', () => {
  it('connects visible labels, hints, and errors while preserving native input behavior', () => {
    const onChange = vi.fn();
    render(
      <TextField
        name="name"
        label="Name"
        hint="Business name"
        error="Enter a name"
        aria-describedby="external-help"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveClass('rounded-full', '!pl-10');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Business name Enter a name');
    expect(input.getAttribute('aria-describedby')).toContain('external-help');
    fireEvent.change(input, { target: { value: 'North & Pine' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('centers field icons against the input when hints appear before the field', () => {
    render(
      <TextField
        label="Phone"
        hint="Use a Philippine phone number"
        hintPosition="before"
        icon="phone"
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Phone' });
    expect(input.parentElement?.querySelector('svg')).toHaveClass('top-1/2');
  });

  it('generates unique field IDs and keeps read-only inputs readable', () => {
    render(
      <>
        <TextField label="First name" />
        <TextField label="Email" value="owner@example.com" readOnly />
      </>,
    );
    const name = screen.getByLabelText('First name');
    const email = screen.getByLabelText('Email');
    expect(name.id).not.toBe(email.id);
    expect(email).toHaveAttribute('readonly');
    expect(email).not.toBeDisabled();
  });

  it.each(['label', 'after'] as const)(
    'retains full accessible validation with %s errors',
    (errorPosition) => {
      render(
        <>
          <p id="external-help">Price guidance</p>
          <TextField
            id="price"
            label="Selling price"
            hint="Branch price"
            aria-describedby="external-help"
            errorPosition={errorPosition}
            error="Enter a positive PHP price with up to two decimal places (maximum 9999999999.99)."
          />
        </>,
      );
      expect(screen.getByText('Enter a valid price.')).toBeVisible();
      expect(
        screen.getByText(
          'Enter a positive PHP price with up to two decimal places (maximum 9999999999.99).',
        ),
      ).toHaveClass('sr-only');
      const input = screen.getByRole('textbox', { name: 'Selling price' });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute(
        'aria-describedby',
        'external-help price-hint price-error-detail',
      );
      expect(document.getElementById('price-error-detail')).toHaveTextContent(
        'Enter a positive PHP price with up to two decimal places (maximum 9999999999.99).',
      );
      expect(input).toHaveAccessibleDescription(
        'Price guidance Branch price Enter a positive PHP price with up to two decimal places (maximum 9999999999.99).',
      );
    },
  );

  it('uses a single page heading and announces feedback semantically', () => {
    render(
      <>
        <PageHeader title="Account" description="Your personal settings" />
        <Notice>Profile saved</Notice>
        <Notice tone="error">Update failed</Notice>
      </>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Account' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Update failed');
  });
});
