'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { createOrganization, listOrganizations } from './organization-api';
import { createOrganizationSchema } from './organization.schemas';
import type { OrganizationAccess } from './organization.types';

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
  const [search, setSearch] = useState('');
  const createDialogRef = useRef<HTMLDialogElement>(null);
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNameError(null);
    setSubmissionError(null);

    const formData = new FormData(form);
    const result = createOrganizationSchema.safeParse({
      name: formData.get('name'),
    });

    if (!result.success) {
      setNameError(result.error.flatten().fieldErrors.name?.[0] ?? null);
      window.requestAnimationFrame(() => {
        const nameField = form.elements.namedItem('name');
        if (nameField instanceof HTMLElement) nameField.focus();
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const organization = await createOrganization(request, result.data.name);
      router.push(`/app/organizations/${organization.id}`);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDialog() {
    setNameError(null);
    setSubmissionError(null);
    createDialogRef.current?.showModal();
  }

  function closeCreateDialog() {
    if (isSubmitting) return;
    createDialogRef.current?.close();
  }

  return (
    <section
      className="mx-auto mt-8 w-full max-w-5xl sm:mt-12"
      aria-labelledby="organization-title"
    >
      <div className="max-w-3xl">
        <p className="mb-4 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Workspace
        </p>
        <h1
          className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]"
          id="organization-title"
        >
          Choose an organization
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          Select the concept store you want to manage. Your access is based on
          the membership assigned to {user?.email}.
        </p>
      </div>

      <div className="mt-8 flex items-end gap-3 max-sm:grid">
        <div className="grid min-w-0 flex-1 gap-2">
          <label className="text-sm font-bold" htmlFor="organization-search">
            Search organizations
          </label>
          <input
            className="min-h-12 max-w-xl rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
            id="organization-search"
            type="search"
            value={search}
            placeholder="ex. My Concept Store"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          className="min-h-12 w-fit cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 max-sm:w-full disabled:cursor-wait disabled:opacity-65"
          type="button"
          onClick={openCreateDialog}
        >
          Create organization
        </button>
      </div>

      <section
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
        aria-labelledby="available-title"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-base font-bold" id="available-title">
            Your organizations
          </h2>
          {!isLoading && !loadError ? (
            <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
              {filteredOrganizations.length}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <ListSkeleton label="Loading organizations" />
        ) : loadError ? (
          <RequestError
            className="mt-5"
            message={loadError}
            onRetry={() => void loadOrganizations()}
          />
        ) : organizations.length === 0 ? (
          <p className="mt-5 leading-7 text-slate-500">
            You do not belong to an organization yet. Create your first one to
            continue.
          </p>
        ) : filteredOrganizations.length === 0 ? (
          <div className="py-10 text-center">
            <h3 className="text-base font-bold">No organizations found</h3>
            <p className="mt-2 leading-7 text-slate-500">
              Try a different organization name.
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrganizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[0.6rem] border border-slate-200 bg-white p-4 text-left text-slate-900 no-underline hover:border-emerald-600"
                  href={`/app/organizations/${organization.id}`}
                >
                  <span className="grid gap-1">
                    <strong>{organization.name}</strong>
                    <small className="text-slate-500">
                      {roleLabels[organization.role]}
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dialog
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 backdrop:bg-slate-950/40"
        ref={createDialogRef}
        onCancel={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onClose={() => {
          setNameError(null);
          setSubmissionError(null);
        }}
        aria-labelledby="create-title"
        aria-describedby="create-description"
      >
        <section className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
                New workspace
              </p>
              <h2 className="mt-2 text-xl font-bold" id="create-title">
                Create an organization
              </h2>
            </div>
            
          </div>
          <form className="mt-5 grid gap-4" onSubmit={handleCreate} noValidate>
            {submissionError ? (
              <p
                className="m-0 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
                role="alert"
              >
                {submissionError}
              </p>
            ) : null}
            <div className="grid gap-2">
              <label className="text-sm font-bold" htmlFor="organization-name">
                Organization name
              </label>
              <input
                className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
                id="organization-name"
                name="name"
                type="text"
                autoComplete="organization"
                maxLength={120}
                aria-invalid={Boolean(nameError)}
                aria-describedby={
                  nameError ? 'organization-name-error' : undefined
                }
              />
              {nameError ? (
                <p
                  id="organization-name-error"
                  className="m-0 text-sm text-red-600"
                >
                  {nameError}
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex justify-between">
              <button
                className="cursor-pointer bg-transparent p-0 font-bold text-slate-500 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
                type="button"
                onClick={closeCreateDialog}
                disabled={isSubmitting}
                aria-label="Close create organization dialog"
              >
                Close
              </button>
              <button
                className="w-fit min-h-9 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating organization…' : 'Create organization'}
              </button>
            </div>
          </form>
        </section>
      </dialog>
    </section>
  );
}
