'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { updateProfileSchema } from '../model/account.schemas';
import { ChangePasswordForm } from './change-password-form';
import { DeleteAccountForm } from './delete-account-form';

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone', string>>;

export function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  if (!user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setSuccess(null);
    const result = updateProfileSchema.safeParse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      setFieldErrors({
        firstName: fields.firstName?.[0],
        lastName: fields.lastName?.[0],
        phone: fields.phone?.[0],
      });
      focusFirstInvalidField(form);
      return;
    }
    setFieldErrors({});
    setIsSaving(true);
    try {
      await updateProfile(result.data);
      setSuccess('Your profile has been updated.');
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your profile could not be updated. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6">
        <BackLink href="/app">All organizations</BackLink>
      </div>
      <PageHeader
        eyebrow="Account"
        title="Profile settings"
        description="Keep your personal details current across your organization memberships."
      />
      <OperationalPanel
        title="Personal information"
        description="Your email is your sign-in identity and cannot be changed here."
      >
        <form
          aria-label="Personal information"
          className="grid gap-5 p-5 sm:p-6"
          onSubmit={submit}
          noValidate
        >
          {error ? <Notice tone="error">{error}</Notice> : null}
          {success ? <Notice>{success}</Notice> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="firstName"
              name="firstName"
              label="First name"
              defaultValue={user.firstName}
              error={fieldErrors.firstName}
              autoComplete="given-name"
              maxLength={80}
            />
            <TextField
              id="lastName"
              name="lastName"
              label="Last name"
              defaultValue={user.lastName}
              error={fieldErrors.lastName}
              autoComplete="family-name"
              maxLength={80}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="phone"
              name="phone"
              label="Phone number"
              defaultValue={user.phone ?? ''}
              error={fieldErrors.phone}
              autoComplete="tel"
              type="tel"
              maxLength={25}
            />
            <TextField
              id="email"
              label="Email address"
              value={user.email}
              readOnly
              type="email"
            />
          </div>
          <div className="flex justify-end border-t border-hairline pt-5">
            <Button type="submit" pending={isSaving} pendingLabel="Saving…">
              Save changes
            </Button>
          </div>
        </form>
      </OperationalPanel>
      <ChangePasswordForm />
      <DeleteAccountForm />
    </div>
  );
}
