'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
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
    setNameError(null);
    setSubmissionError(null);

    const formData = new FormData(event.currentTarget);
    const result = createOrganizationSchema.safeParse({
      name: formData.get('name'),
    });

    if (!result.success) {
      setNameError(result.error.flatten().fieldErrors.name?.[0] ?? null);
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
      className="organization-entry"
      aria-labelledby="organization-title"
    >
      <div className="organization-heading">
        <p className="eyebrow">Workspace</p>
        <h1 id="organization-title">Choose an organization</h1>
        <p>
          Select the concept store you want to manage. Your access is based on
          the membership assigned to {user?.email}.
        </p>
      </div>

      <div className="organization-grid">
        <section
          className="organization-panel"
          aria-labelledby="available-title"
        >
          <div className="panel-heading">
            <h2 id="available-title">Your organizations</h2>
            {!isLoading && !loadError ? (
              <span>{organizations.length}</span>
            ) : null}
          </div>

          {isLoading ? (
            <p className="muted-message" role="status">
              Loading organizations…
            </p>
          ) : loadError ? (
            <div className="inline-error" role="alert">
              <p>{loadError}</p>
              <button type="button" onClick={() => void loadOrganizations()}>
                Try again
              </button>
            </div>
          ) : organizations.length === 0 ? (
            <p className="muted-message">
              You do not belong to an organization yet. Create your first one to
              continue.
            </p>
          ) : (
            <ul className="organization-list">
              {organizations.map((organization) => (
                <li key={organization.id}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/app/organizations/${organization.id}`)
                    }
                  >
                    <span>
                      <strong>{organization.name}</strong>
                      <small>{roleLabels[organization.role]}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="organization-panel" aria-labelledby="create-title">
          <div className="panel-heading">
            <h2 id="create-title">Create an organization</h2>
          </div>
          <p className="panel-description">
            Create a concept-store workspace. You will become its owner.
          </p>
          <form
            className="organization-form"
            onSubmit={handleCreate}
            noValidate
          >
            {submissionError ? (
              <p className="form-alert" role="alert">
                {submissionError}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="organization-name">Organization name</label>
              <input
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
                <p id="organization-name-error" className="field-error">
                  {nameError}
                </p>
              ) : null}
            </div>
            <button
              className="primary-button"
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
