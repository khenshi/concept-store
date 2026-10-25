'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import {
  sanitizePhilippinePhoneInput,
  updateProfileSchema,
} from '../model/account.schemas';
import { ChangePasswordForm } from './change-password-form';
import { ColorThemePicker } from './color-theme-picker';
import { DeleteAccountForm } from './delete-account-form';
import { ActiveSessionsPanel } from './active-sessions-panel';

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone', string>>;
type SectionId = 'profile' | 'appearance' | 'security';

const sectionNavigation: readonly { label: string; id: SectionId }[] = [
  { label: 'Profile', id: 'profile' },
  { label: 'Appearance', id: 'appearance' },
  { label: 'Security', id: 'security' },
];

export function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('profile');

  useEffect(() => {
    function updateActiveSection() {
      if (document.documentElement.scrollHeight <= window.innerHeight) return;

      const marker = window.scrollY + 160;
      let nextSection: SectionId = 'profile';
      for (const { id } of sectionNavigation) {
        const section = document.getElementById(id);
        if (
          section &&
          section.getBoundingClientRect().top + window.scrollY <= marker
        ) {
          nextSection = id;
        }
      }
      setActiveSection(nextSection);
    }

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

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
    <div className="min-h-[calc(100dvh-4.25rem)] bg-canvas px-4 pb-10 sm:px-6 lg:px-8">
      <OperationalPage>
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-4">
            <BackLink href="/app">All organizations</BackLink>
          </div>
          <PageHeader
            title="Account settings"
            description="Manage your profile, workspace appearance, and account security."
            className="pb-6"
          />
          <nav
            className="sticky top-17 z-30 -mx-4 border-b border-hairline bg-canvas px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            aria-label="Account settings sections"
          >
            <div className="flex min-w-max gap-1">
              {sectionNavigation.map(({ label, id }) => {
                const isActive = activeSection === id;
                return (
                  <a
                    key={id}
                    className={`flex items-center rounded-none border-b-2 px-3 py-2 text-sm font-semibold no-underline transition-colors ${
                      isActive
                        ? 'border-action text-ink'
                        : 'border-transparent text-muted hover:border-selected-border hover:text-ink'
                    }`}
                    href={`#${id}`}
                    aria-current={isActive ? 'location' : undefined}
                    onClick={() => setActiveSection(id)}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </nav>
          <div className="grid gap-6 pt-6">
            <section
              id="profile"
              className="scroll-mt-32 card-surface p-4 sm:p-5"
            >
              <OperationalPanel
                variant="open"
                className="!mt-0 !bg-transparent"
                title="Personal information"
                description="Your email is your sign-in identity and cannot be changed here."
              >
                <form
                  aria-label="Personal information"
                  className="grid gap-4 py-4 sm:py-5"
                  onSubmit={submit}
                  noValidate
                >
                  {error ? <Notice tone="error">{error}</Notice> : null}
                  {success ? <Notice>{success}</Notice> : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="firstName"
                      name="firstName"
                      label="First name"
                      defaultValue={user.firstName}
                      error={fieldErrors.firstName}
                      autoComplete="given-name"
                      maxLength={80}
                      disabled={isSaving}
                    />
                    <TextField
                      id="lastName"
                      name="lastName"
                      label="Last name"
                      defaultValue={user.lastName}
                      error={fieldErrors.lastName}
                      autoComplete="family-name"
                      maxLength={80}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="phone"
                      name="phone"
                      label="Phone number"
                      defaultValue={user.phone ?? ''}
                      onChange={(event) => {
                        const sanitized = sanitizePhilippinePhoneInput(
                          event.currentTarget.value,
                        );
                        if (sanitized !== event.currentTarget.value) {
                          event.currentTarget.value = sanitized;
                        }
                      }}
                      error={fieldErrors.phone}
                      autoComplete="tel"
                      type="tel"
                      inputMode="tel"
                      placeholder="09XX XXX XXXX"
                      hint="Use a Philippine number, such as 09XX XXX XXXX or +63 9XX XXX XXXX."
                      maxLength={25}
                      disabled={isSaving}
                    />
                    <TextField
                      id="email"
                      label={
                        <span className="flex items-center gap-2">
                          Email address
                          <span className="text-xs font-medium text-muted">
                            Read-only
                          </span>
                        </span>
                      }
                      value={user.email}
                      readOnly
                      type="email"
                      hint="This is the email used to sign in."
                    />
                  </div>
                  <div className="flex justify-end border-t border-hairline pt-4">
                    <Button
                      variant="accent"
                      type="submit"
                      pending={isSaving}
                      pendingLabel="Saving…"
                    >
                      Save changes
                    </Button>
                  </div>
                </form>
              </OperationalPanel>
            </section>
            <section
              id="appearance"
              className="scroll-mt-32 card-surface p-4 sm:p-5"
            >
              <ColorThemePicker className="!mt-0 !bg-transparent" />
            </section>
            <section
              id="security"
              className="scroll-mt-32 card-surface p-4 sm:p-5"
            >
              <div>
                <h2 className="text-base font-semibold text-ink">Security</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Keep your sign-in credentials secure and review account
                  access.
                </p>
              </div>
              <div className="mt-5 border-t border-hairline pt-5">
                <ChangePasswordForm className="!mt-0 !bg-transparent" />
              </div>
              <ActiveSessionsPanel className="!mt-5 !bg-transparent" />
              <DeleteAccountForm className="!mt-5 !bg-transparent" />
            </section>
          </div>
        </div>
      </OperationalPage>
    </div>
  );
}
