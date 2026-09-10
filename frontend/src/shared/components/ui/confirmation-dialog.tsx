'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
    cancelRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [close, pending]);

  const confirmationDialog = pending ? (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-5"
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/40" aria-hidden="true" />
      <section
        className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
      >
        <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Confirm action
        </p>
        <h2
          className="mt-2 text-xl font-bold tracking-tight text-slate-950"
          id="confirmation-title"
        >
          {pending.title}
        </h2>
        <p
          className="mt-3 leading-7 text-slate-500"
          id="confirmation-description"
        >
          {pending.description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            className="min-h-11 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => close(false)}
          >
            Cancel
          </button>
          <button
            className={`min-h-11 cursor-pointer rounded-[0.65rem] border-0 px-4 font-bold text-white ${pending.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            type="button"
            onClick={() => close(true)}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmationDialog };
}
