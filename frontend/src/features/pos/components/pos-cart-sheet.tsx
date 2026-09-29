'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function PosCartSheet({
  open,
  lockBackground = true,
  onClose,
  children,
}: {
  open: boolean;
  lockBackground?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    if (lockBackground) document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() =>
      dialog.querySelector<HTMLElement>('h2')?.focus(),
    );
    return () => {
      dialog.close();
      if (lockBackground) document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [open, lockBackground]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Cart"
      aria-hidden={!open}
      inert={!open}
      className="fixed inset-x-0 bottom-0 m-0 hidden h-[min(88dvh,48rem)] max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-none flex-col overflow-hidden rounded-t-panel border border-b-0 border-hairline bg-surface p-0 text-ink open:flex backdrop:bg-scrim"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
