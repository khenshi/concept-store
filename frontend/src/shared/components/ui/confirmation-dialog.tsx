'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from './button';

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
}

interface PendingConfirmation extends ConfirmationOptions {
  resolve(value: boolean): void;
}

export function useConfirmationDialog(): {
  confirm(options: ConfirmationOptions): Promise<boolean>;
  confirmationDialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogId = useId();

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  useEffect(() => {
    if (!pending) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)',
        );
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [close, pending]);

  const confirmationDialog = pending ? (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-5"
      role="presentation"
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" />
      <section
        ref={dialogRef}
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-md overflow-y-auto rounded-panel border border-hairline bg-surface p-6 text-ink shadow-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
      >
        <p className="text-xs font-medium text-muted">Confirm action</p>
        <h2
          className="mt-2 text-xl font-semibold tracking-tight text-ink"
          id={`${dialogId}-title`}
        >
          {pending.title}
        </h2>
        <p className="mt-3 leading-7 text-muted" id={`${dialogId}-description`}>
          {pending.description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            variant={pending.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => close(true)}
          >
            {pending.confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmationDialog };
}
