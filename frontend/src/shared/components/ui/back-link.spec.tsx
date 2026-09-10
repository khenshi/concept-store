import { render, screen } from '@testing-library/react';
import { BackLink } from './back-link';

describe('BackLink', () => {
  it('renders navigation as a button-styled link', () => {
    render(<BackLink href="/parent">Back to parent</BackLink>);

    expect(
      screen.getByRole('link', { name: 'Back to parent' }),
    ).toHaveAttribute('href', '/parent');
  });
});
