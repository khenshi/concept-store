'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function FormDialog({
  title,
  description,
  headerAside,
  initialFocusRef,
  size = 'default',
  pending = false,
  onClose,
  children,
}: {
  title: string;
  description: string;
  headerAside?: ReactNode;
  initialFocusRef?: { current: HTMLElement | null };
  size?: 'default' | 'form';
  pending?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    (initialFocusRef?.current ?? headingRef.current)?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [initialFocusRef]);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain rounded-panel border border-hairline bg-surface p-6 text-ink shadow-overlay backdrop:bg-scrim sm:p-8 ${size === 'form' ? 'max-w-2xl' : 'max-w-5xl'}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          !pending &&
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <div className="flex items-start">
        <h2
          id={`${id}-title`}
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 break-words text-2xl font-semibold tracking-tight outline-none"
        >
          {title}
        </h2>
      </div>
      <p id={`${id}-description`} className="mt-2 text-sm leading-6 text-muted">
        {description}
      </p>
      {headerAside ? (
        <div className="mt-3 flex max-w-full flex-wrap justify-start gap-2">
          {headerAside}
        </div>
      ) : null}
      {children}
    </dialog>
  );
}
