'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { Button } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
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
  const passwordRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        <FormDialog
          role="alertdialog"
          title="Permanently delete your account?"
          description="You will lose access to every organization. Historical operational records will retain an anonymized reference. Enter your password to continue."
          eyebrow={<span className="text-danger">Danger zone</span>}
          size="confirmation"
          initialFocusRef={passwordRef}
          returnFocusRef={triggerRef}
          dismissOnBackdrop={false}
          pending={isDeleting}
          onClose={closeModal}
        >
          <form
            aria-label="Confirm account deletion"
            className="mt-5 grid gap-5"
            onSubmit={submit}
            noValidate
          >
            <TextField
              ref={passwordRef}
              id="deletePassword"
              name="deletePassword"
              label="Password"
              type="password"
              placeholder="e.g. ••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={128}
              error={passwordError}
              showPasswordToggle
              disabled={isDeleting}
            />
            <ModalActionRow
              feedback={
                error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null
              }
            >
              <Button
                variant="quiet"
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
            </ModalActionRow>
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
