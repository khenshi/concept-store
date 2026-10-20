'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function FormDialog({
  title,
  description,
  headerAside,
  initialFocusRef,
  returnFocusRef,
  size = 'default',
  role,
  dismissOnBackdrop = true,
  eyebrow,
  pending = false,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  headerAside?: ReactNode;
  initialFocusRef?: { current: HTMLElement | null };
  returnFocusRef?: { current: HTMLElement | null };
  size?:
    | 'default'
    | 'form'
    | 'wide'
    | 'compact'
    | 'medium'
    | 'large'
    | 'confirmation';
  role?: 'dialog' | 'alertdialog';
  dismissOnBackdrop?: boolean;
  eyebrow?: ReactNode;
  pending?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousTitle = useRef(title);
  useEffect(() => {
    if (previousTitle.current !== title) headingRef.current?.focus();
    previousTitle.current = title;
  }, [title]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const returnFocus = returnFocusRef?.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    (initialFocusRef?.current ?? headingRef.current)?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      const focusTarget =
        previousFocus instanceof HTMLElement &&
        previousFocus !== document.body &&
        previousFocus.isConnected
          ? previousFocus
          : returnFocus;
      focusTarget?.focus();
    };
  }, [initialFocusRef, returnFocusRef]);
  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain rounded-panel border border-hairline bg-surface p-6 text-ink shadow-overlay backdrop:bg-scrim sm:p-8 ${{ default: 'max-w-3xl', form: 'max-w-2xl', wide: 'max-w-7xl', compact: 'max-w-xl', medium: 'max-w-4xl', large: 'max-w-5xl', confirmation: 'max-w-md' }[size]}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          !pending &&
          dismissOnBackdrop &&
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      {eyebrow ? (
        <div className="mb-2 text-xs font-medium text-muted">{eyebrow}</div>
      ) : null}
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
      {description ? (
        <p
          id={`${id}-description`}
          className="mt-2 text-sm leading-6 text-muted"
        >
          {description}
        </p>
      ) : null}
      {headerAside ? (
        <div className="mt-3 flex max-w-full flex-wrap justify-start gap-2">
          {headerAside}
        </div>
      ) : null}
      {children}
    </dialog>
  );
}
