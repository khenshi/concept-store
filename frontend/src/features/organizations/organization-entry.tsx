'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

      <div className="mt-10 grid items-start gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <section
          className="rounded-xl border border-slate-200 bg-white p-6"
          aria-labelledby="available-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-base font-bold" id="available-title">
              Your organizations
            </h2>
            {!isLoading && !loadError ? (
              <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
                {organizations.length}
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
          ) : (
            <ul className="mt-5 grid list-none gap-2.5 p-0">
              {organizations.map((organization) => (
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

        <section
          className="rounded-xl border border-slate-200 bg-white p-6"
          aria-labelledby="create-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-base font-bold" id="create-title">
              Create an organization
            </h2>
          </div>
          <p className="mt-4 leading-7 text-slate-500">
            Create a concept-store workspace. You will become its owner.
          </p>
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
            <button
              className="w-fit min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating organization…' : 'Create organization'}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
