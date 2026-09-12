'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';

export function MobileOrganizationDrawer({
  id,
  organizationName,
  onClose,
  triggerRef,
  children,
}: {
  id: string;
  organizationName?: string;
  onClose(): void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    const desktop = window.matchMedia('(min-width: 1024px)');
    dialog?.showModal();
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const handleResize = () => {
      if (desktop.matches) onClose();
    };
    handleResize();
    desktop.addEventListener('change', handleResize);
    return () => {
      desktop.removeEventListener('change', handleResize);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [onClose, triggerRef]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(22rem,calc(100%_-_2rem))] max-w-none flex-col border-0 border-r border-hairline bg-surface p-0 text-ink shadow-overlay open:flex backdrop:bg-ink/40 print:hidden"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline p-5">
        <div className="min-w-0">
          <h2 className="font-semibold" id={`${id}-title`}>
            Workspace navigation
          </h2>
          <p className="mt-1 truncate text-sm text-muted">
            {organizationName ?? 'Your organization'}
          </p>
        </div>
        <Button
          ref={closeRef}
          variant="quiet"
          onClick={onClose}
          aria-label="Close navigation"
          className="shrink-0 px-2"
        >
          <Icon name="close" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {children}
      </div>
    </dialog>
  );
}
