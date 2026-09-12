'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { changePasswordSchema } from '../model/account.schemas';

type FieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
>;

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    const result = changePasswordSchema.safeParse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      setFieldErrors({
        currentPassword: fields.currentPassword?.[0],
        newPassword: fields.newPassword?.[0],
        confirmPassword: fields.confirmPassword?.[0],
      });
      focusFirstInvalidField(form);
      return;
    }
    setFieldErrors({});
    setIsSaving(true);
    try {
      await changePassword({
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
      });
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your password could not be changed. Please try again.',
      );
      setIsSaving(false);
    }
  }

  return (
    <OperationalPanel
      title="Password"
      description="Changing your password signs you out on every device."
    >
      <form
        aria-label="Password"
        className="grid gap-5 p-5 sm:p-6"
        onSubmit={submit}
        noValidate
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField
          id="currentPassword"
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          error={fieldErrors.currentPassword}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="newPassword"
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            hint="Use at least 12 characters."
            error={fieldErrors.newPassword}
          />
          <TextField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            error={fieldErrors.confirmPassword}
          />
        </div>
        <div className="flex justify-end border-t border-hairline pt-5">
          <Button
            type="submit"
            pending={isSaving}
            pendingLabel="Changing password…"
          >
            Change password
          </Button>
        </div>
      </form>
    </OperationalPanel>
  );
}
