import { render, screen } from '@testing-library/react';
import { GuestShell } from './guest-shell';

describe('GuestShell', () => {
  it('keeps the entry form narrow and separate from optional context without a card frame', () => {
    render(
      <GuestShell eyebrow="Welcome" title="Sign in">
        <form aria-label="Sign in form" />
      </GuestShell>,
    );

    const section = screen
      .getByRole('heading', { name: 'Sign in' })
      .closest('section');
    expect(section).toHaveClass('max-w-xl', 'bg-surface');
    expect(section).not.toHaveClass('border-y');
    expect(section).not.toHaveClass('rounded-feature');
    expect(
      screen.getByRole('form', { name: 'Sign in form' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Workspace context' }),
    ).toBeInTheDocument();
  });
});
