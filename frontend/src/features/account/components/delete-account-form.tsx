'use client';

import { useState, type FormEvent } from 'react';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { deleteAccountSchema } from '../model/account.schemas';

export function DeleteAccountForm() {
  const { deleteAccount } = useAuth();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDeleting || isConfirming) return;
    const form = event.currentTarget;
    setError(null);
    const result = deleteAccountSchema.safeParse({
      password: new FormData(form).get('deletePassword'),
    });
    if (!result.success) {
      setPasswordError(
        result.error.flatten().fieldErrors.password?.[0] ?? null,
      );
      focusFirstInvalidField(form);
      return;
    }
    setPasswordError(null);
    setIsConfirming(true);
    const approved = await confirm({
      title: 'Permanently delete your account?',
      description:
        'You will lose access to every organization. Historical operational records will retain an anonymized reference. This action cannot be undone.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    setIsConfirming(false);
    if (!approved) return;
    setIsDeleting(true);
    try {
      await deleteAccount(result.data);
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
        title="Delete account"
        description="This removes your access and personal details across the platform. Sole organization owners must transfer ownership first."
      >
        <form
          aria-label="Delete account"
          className="grid gap-5 py-5 sm:py-6"
          onSubmit={submit}
          noValidate
        >
          <p className="text-sm font-medium text-danger">
            This action is permanent and cannot be undone.
          </p>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <TextField
            containerClassName="max-w-md"
            id="deletePassword"
            name="deletePassword"
            label="Confirm your password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            error={passwordError}
          />
          <div className="flex justify-end border-t border-hairline pt-5">
            <Button
              variant="secondary"
              className="border-danger text-danger"
              type="submit"
              pending={isDeleting}
              pendingLabel="Deleting account…"
            >
              Delete account
            </Button>
          </div>
        </form>
      </OperationalPanel>
      {confirmationDialog}
    </>
  );
}
