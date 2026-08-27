'use client';

import { useState, type FormEvent } from 'react';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { deleteAccountSchema } from './account.schemas';

export function DeleteAccountForm() {
  const { deleteAccount } = useAuth();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = deleteAccountSchema.safeParse({
      password: new FormData(event.currentTarget).get('deletePassword'),
    });
    if (!result.success) {
      setPasswordError(
        result.error.flatten().fieldErrors.password?.[0] ?? null,
      );
      return;
    }
    setPasswordError(null);

    const approved = await confirm({
      title: 'Permanently delete your account?',
      description:
        'You will lose access to every organization. Historical operational records will retain an anonymized reference. This action cannot be undone.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!approved) return;

    setError(null);
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
      <section className="mt-6 rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 px-5 py-5 sm:px-6">
          <p className="text-xs font-bold tracking-[0.12em] text-red-600 uppercase">
            Danger zone
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">
            Delete account
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            This removes your access and personal details across the platform.
            Sole organization owners must transfer ownership first.
          </p>
        </div>
        <form className="grid gap-5 p-5 sm:p-6" onSubmit={submit} noValidate>
          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="grid max-w-md gap-2">
            <label
              className="text-sm font-bold text-slate-800"
              htmlFor="deletePassword"
            >
              Confirm your password
            </label>
            <input
              className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-100 aria-invalid:border-red-600"
              id="deletePassword"
              name="deletePassword"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={
                passwordError ? 'delete-password-error' : undefined
              }
            />
            {passwordError ? (
              <p className="text-sm text-red-600" id="delete-password-error">
                {passwordError}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end border-t border-red-100 pt-5">
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-red-600 px-5 font-bold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting account…' : 'Delete account'}
            </button>
          </div>
        </form>
      </section>
      {confirmationDialog}
    </>
  );
}
