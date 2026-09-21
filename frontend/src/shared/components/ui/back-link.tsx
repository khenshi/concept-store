import Link from 'next/link';
import { buttonStyles } from './button';
import { Icon } from './icon';

export function BackLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: string;
  className?: string;
}) {
  return (
    <Link
      className={buttonStyles({
        variant: 'secondary',
        className: `w-fit ${className}`,
      })}
      href={href}
    >
      <Icon name="arrow" className="size-4 rotate-180" />
      {children}
    </Link>
  );
}
