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
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { Notice } from '@/shared/components/ui/notice';
import {
  OperationalPanel,
  OperationalToolbar,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
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

export function OrganizationEntry() {
  const router = useRouter();
  const { request, user } = useAuth();
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
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10"
      aria-labelledby="organization-title"
    >
      <PageHeader
        id="organization-title"
        eyebrow="Your workspaces"
        title="Choose an organization"
        description={
          <>
            Select the concept store you want to manage. Your access is based on
            the membership assigned to{' '}
            <span className="break-all">{user?.email}</span>.
          </>
        }
        action={
          <Button
            ref={createTriggerRef}
            onClick={openCreateDialog}
            className="max-sm:w-full"
          >
            Create organization
          </Button>
        }
      />
      <OperationalPanel
        title="Your organizations"
        description="A separate workspace for each business you belong to."
        action={
          !isLoading && !loadError ? (
            <span
              className="inline-flex min-w-7 justify-center rounded-full bg-selected px-2 py-1 text-xs font-semibold text-ink"
              aria-label={`${filteredOrganizations.length} organizations`}
            >
              {filteredOrganizations.length}
            </span>
          ) : undefined
        }
      >
        <OperationalToolbar>
          <TextField
            containerClassName="max-w-xl"
            id="organization-search"
            label="Search organizations"
            type="search"
            value={search}
            placeholder="Find an organization by name"
            onChange={(event) => setSearch(event.target.value)}
          />
        </OperationalToolbar>
        <div>
          {isLoading ? (
            <ListSkeleton
              label="Loading organizations"
              className="px-5 py-5 sm:px-6"
            />
          ) : loadError ? (
            <RequestError
              className="px-5 py-6 sm:px-6"
              message={loadError}
              onRetry={() => void loadOrganizations()}
            />
          ) : organizations.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
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
            <div className="px-5 py-12 text-center sm:px-6">
              <h3 className="font-semibold text-ink">No organizations found</h3>
              <p className="mt-3 text-sm text-muted">
                Try a different organization name.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {filteredOrganizations.map((organization) => (
                <li key={organization.id}>
                  <Link
                    className="group flex min-h-20 w-full items-center gap-4 px-5 py-5 text-ink no-underline hover:bg-subtle sm:px-6"
                    href={`/app/organizations/${organization.id}`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-control border border-hairline bg-subtle text-muted">
                      <Icon name="building" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block break-words text-sm font-semibold">
                        {organization.name}
                      </strong>
                      <small className="mt-1 block text-xs text-muted">
                        {roleLabels[organization.role]}
                      </small>
                    </span>
                    <Icon name="arrow" className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </OperationalPanel>
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
