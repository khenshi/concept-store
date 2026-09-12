import Link from 'next/link';
import { buttonStyles } from './button';

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      className={buttonStyles({ variant: 'secondary', className: 'w-fit' })}
      href={href}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
