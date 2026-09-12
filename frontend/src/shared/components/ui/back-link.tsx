import Link from 'next/link';
import { buttonStyles } from './button';
import { Icon } from './icon';

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
      <Icon name="arrow" className="size-4 rotate-180" />
      {children}
    </Link>
  );
}
