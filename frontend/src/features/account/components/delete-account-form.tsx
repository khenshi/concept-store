'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { deleteAccountSchema } from '../model/account.schemas';

export function DeleteAccountForm({ className = '' }: { className?: string }) {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusDialog = () =>
      dialogRef.current
        ?.querySelector<HTMLElement>('input, button:not(:disabled)')
        ?.focus();
    const frameId = window.requestAnimationFrame(focusDialog);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not(:disabled), button:not(:disabled)',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget =
        previousFocus instanceof HTMLElement &&
        previousFocus !== document.body &&
        previousFocus.isConnected
          ? previousFocus
          : triggerRef.current;
      focusTarget?.focus();
    };
  }, [isDeleting, isOpen]);

  function openModal() {
    setPassword('');
    setPasswordError(null);
    setError(null);
    setMessage(null);
    setIsOpen(true);
  }

  function closeModal() {
    if (isDeleting) return;
    setIsOpen(false);
    setPassword('');
    setPasswordError(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDeleting) return;
    const form = event.currentTarget;
    setError(null);
    const result = deleteAccountSchema.safeParse({ password });
    if (!result.success) {
      setPasswordError(
        result.error.flatten().fieldErrors.password?.[0] ?? null,
      );
      focusFirstInvalidField(form);
      return;
    }
    setPasswordError(null);
    setIsDeleting(true);
    try {
      await deleteAccount(result.data);
      setMessage('Your account has been deleted.');
      setIsDeleting(false);
      setIsOpen(false);
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your account could not be deleted. Please try again.',
      );
      setIsDeleting(false);
    }
  }

  return (
    <>
      <OperationalPanel
        variant="open"
        className={className}
        title="Danger zone"
        description="Delete your account and remove your access to Kapwesto. Sole organization owners must transfer ownership first."
      >
        <div className="flex flex-col gap-4 border-t border-hairline py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Delete account</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              This action is permanent and cannot be undone.
            </p>
          </div>
          <Button
            ref={triggerRef}
            variant="secondary"
            className="w-fit shrink-0 border-danger text-danger hover:border-danger hover:bg-danger/5"
            type="button"
            onClick={openModal}
          >
            Delete account
          </Button>
        </div>
        {message ? <Notice>{message}</Notice> : null}
        {error && !isOpen ? <Notice tone="error">{error}</Notice> : null}
      </OperationalPanel>
      {isOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4 sm:p-6">
          <div className="modal-backdrop" aria-hidden="true" />
          <section
            ref={dialogRef}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-panel border border-hairline bg-surface p-5 text-ink shadow-overlay sm:p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <p className="text-xs font-medium text-danger">Danger zone</p>
            <h2
              className="mt-2 text-xl font-semibold tracking-tight text-ink"
              id={titleId}
            >
              Permanently delete your account?
            </h2>
            <p
              className="mt-3 whitespace-pre-line leading-7 text-muted"
              id={descriptionId}
            >
              You will lose access to every organization. Historical operational
              records will retain an anonymized reference. Enter your password
              to continue.
            </p>
            <form
              aria-label="Confirm account deletion"
              className="mt-5 grid gap-5"
              onSubmit={submit}
              noValidate
            >
              {error ? <Notice tone="error">{error}</Notice> : null}
              <TextField
                id="deletePassword"
                name="deletePassword"
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                maxLength={128}
                error={passwordError}
                showPasswordToggle
                disabled={isDeleting}
              />
              <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeModal}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  type="submit"
                  pending={isDeleting}
                  pendingLabel="Deleting account…"
                >
                  Delete account
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
