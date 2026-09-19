'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Notice } from '@/shared/components/ui/notice';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { createOrganization, listOrganizations } from '../api/organization-api';
import { createOrganizationSchema } from '../model/organization.schemas';
import type { OrganizationAccess } from '../model/organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function organizationInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.length === 1
    ? words[0].slice(0, 1).toUpperCase()
    : `${words[0][0]}${words.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function OrganizationGridSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading organizations"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="min-h-40 animate-pulse rounded-panel border border-hairline bg-surface p-4"
          key={index}
          aria-hidden="true"
        >
          <div className="size-8 rounded-control bg-selected" />
          <div className="mt-6 h-4 w-3/4 rounded bg-selected" />
          <div className="mt-3 h-3 w-1/2 rounded bg-selected" />
          <div className="mt-7 h-3 w-2/5 rounded bg-selected" />
        </div>
      ))}
    </div>
  );
}

export function OrganizationEntry() {
  const router = useRouter();
  const { request } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const filteredOrganizations = organizations.filter((organization) =>
    organization.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setOrganizations(await listOrganizations(request));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    void listOrganizations(request)
      .then((result) => {
        if (active) setOrganizations(result);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateOpen]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    setNameError(null);
    setSubmissionError(null);
    const result = createOrganizationSchema.safeParse({
      name: new FormData(form).get('name'),
    });
    if (!result.success) {
      setNameError(result.error.flatten().fieldErrors.name?.[0] ?? null);
      focusFirstInvalidField(form);
      return;
    }
    setIsSubmitting(true);
    try {
      const organization = await createOrganization(request, result.data.name);
      createDialogRef.current?.close();
      router.push(`/app/organizations/${organization.id}`);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDialog(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget;
    setNameError(null);
    setSubmissionError(null);
    createDialogRef.current?.showModal();
    nameRef.current?.focus();
    setIsCreateOpen(true);
  }

  return (
    <section
      className="min-h-[calc(100dvh-4.25rem)] bg-surface"
      aria-labelledby="organization-title"
    >
      <div className="mx-auto w-full max-w-[68rem] px-5 py-10 sm:px-8 lg:py-14">
        <header className="flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
          <div className="min-w-0">
            <h1
              id="organization-title"
              className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.045em] text-ink"
            >
              Your organizations
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              Switch between the teams and workspaces you belong to, or create a
              new place for your next project.
            </p>
          </div>
          <Button
            variant="accent"
            ref={createTriggerRef}
            onClick={openCreateDialog}
            className="max-sm:w-full"
          >
            Create organization
          </Button>
        </header>

        <div className="mt-10 flex items-center justify-between gap-5 max-sm:items-stretch max-sm:flex-col">
          <TextField
            containerClassName="w-full max-w-sm"
            id="organization-search"
            label="Search organizations"
            type="search"
            value={search}
            placeholder="Find an organization by name"
            onChange={(event) => setSearch(event.target.value)}
          />
          {!isLoading && !loadError ? (
            <span
              className="shrink-0 text-xs text-muted sm:pb-1"
              aria-label={`${filteredOrganizations.length} organizations`}
            >
              {filteredOrganizations.length}{' '}
              {filteredOrganizations.length === 1
                ? 'organization'
                : 'organizations'}
            </span>
          ) : null}
        </div>

        <div className="mt-7">
          {isLoading ? (
            <OrganizationGridSkeleton />
          ) : loadError ? (
            <RequestError
              className="max-w-xl py-8"
              message={loadError}
              onRetry={() => void loadOrganizations()}
            />
          ) : organizations.length === 0 ? (
            <div className="py-16 text-center">
              <Icon
                name="building"
                className="mx-auto mb-4 size-6 text-muted"
              />
              <h3 className="font-semibold text-ink">
                Your first workspace starts here
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
                You do not belong to an organization yet. Create your first one
                to continue.
              </p>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={openCreateDialog}
              >
                Create your first organization
              </Button>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-16 text-center">
              <h3 className="font-semibold text-ink">No organizations found</h3>
              <p className="mt-3 text-sm text-muted">
                Try a different organization name.
              </p>
            </div>
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrganizations.map((organization) => (
                <li key={organization.id} className="min-w-0">
                  <Link
                    className="group flex min-h-40 w-full flex-col rounded-panel border border-hairline bg-surface p-4 text-ink no-underline transition-[border-color,box-shadow] duration-150 hover:border-selected-border hover:shadow-floating"
                    href={`/app/organizations/${organization.id}`}
                  >
                    <span className="flex items-start justify-between gap-4">
                      <span className="grid size-8 place-items-center rounded-control bg-accent-soft text-sm font-semibold text-accent">
                        {organizationInitials(organization.name)}
                      </span>
                      <Icon
                        name="arrow"
                        className="mt-1 size-4 text-muted group-hover:text-accent"
                      />
                    </span>
                    <span className="mt-6 min-w-0">
                      <strong className="block break-words text-base font-semibold">
                        {organization.name}
                      </strong>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-accent">
                          {roleLabels[organization.role]}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <dialog
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-panel border border-hairline bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40"
        ref={createDialogRef}
        onCancel={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onClose={() => {
          setIsCreateOpen(false);
          setNameError(null);
          setSubmissionError(null);
          createTriggerRef.current?.focus();
        }}
        aria-labelledby="create-title"
        aria-describedby="create-description"
      >
        <section className="p-6 sm:p-7">
          <p className="mb-2 text-xs font-medium text-muted">New workspace</p>
          <h2
            className="text-xl font-semibold tracking-tight"
            id="create-title"
          >
            Create an organization
          </h2>
          <p
            className="mt-3 text-sm leading-6 text-muted"
            id="create-description"
          >
            Give your concept-store business a name. You will become its first
            owner.
          </p>
          <form
            aria-label="Create organization"
            className="mt-6 grid gap-5"
            onSubmit={handleCreate}
            noValidate
          >
            {submissionError ? (
              <Notice tone="error">{submissionError}</Notice>
            ) : null}
            <TextField
              ref={nameRef}
              id="organization-name"
              name="name"
              label="Organization name"
              type="text"
              autoComplete="organization"
              maxLength={120}
              error={nameError}
            />
            <div className="mt-1 flex flex-wrap justify-end gap-3 border-t border-hairline pt-5">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!isSubmitting) createDialogRef.current?.close();
                }}
                disabled={isSubmitting}
                aria-label="Close create organization dialog"
              >
                Close
              </Button>
              <Button
                type="submit"
                pending={isSubmitting}
                pendingLabel="Creating organization…"
              >
                Create organization
              </Button>
            </div>
          </form>
        </section>
      </dialog>
    </section>
  );
}
