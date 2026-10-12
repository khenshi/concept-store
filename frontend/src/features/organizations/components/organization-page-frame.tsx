import type { ReactNode } from 'react';
import { OperationalPage } from '@/shared/components/ui/operational-page';

export function OrganizationPageFrame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="-mx-4 -mb-10 min-h-[calc(100dvh-4.25rem)] flow-root bg-canvas px-4 pb-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
      <OperationalPage>
        <div className={`mx-auto w-full ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          {children}
        </div>
      </OperationalPage>
    </div>
  );
}
