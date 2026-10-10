'use client';
import { useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { InputControl } from '@/shared/components/ui/input-control';
import { createSpaceType } from '../api/space-api';
import type { SpaceType } from '../model/space.schemas';

export function SpaceTypeCreator({
  organizationId,
  onCreated,
  onPendingChange,
  onDirtyChange,
  onDiscard,
  compact = false,
}: {
  organizationId: string;
  onCreated(type: SpaceType): void;
  onPendingChange?(pending: boolean): void;
  onDirtyChange?(dirty: boolean): void;
  onDiscard?(): void;
  compact?: boolean;
}) {
  const { request } = useAuth();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const fieldId = useId();
  const inlineError = error
    ? error.length > 72
      ? `${error.slice(0, 69).trimEnd()}…`
      : error
    : null;
  async function save() {
    if (lock.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a type name.');
      return;
    }
    if (trimmed.length > 80) {
      setError('Enter a type name with 1–80 characters.');
      return;
    }
    lock.current = true;
    setPending(true);
    onPendingChange?.(true);
    setError(null);
    try {
      const type = await createSpaceType(request, organizationId, trimmed);
      setName('');
      onDirtyChange?.(false);
      onCreated(type);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Type could not be created. Try again.',
      );
    } finally {
      lock.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }
  const input = (
    <InputControl
      id={fieldId}
      icon="tag"
      maxLength={80}
      value={name}
      disabled={pending}
      aria-invalid={Boolean(error)}
      aria-describedby={
        [
          compact && error ? `${fieldId}-error` : undefined,
          compact ? `${fieldId}-hint` : undefined,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onChange={(event) => {
        const value = event.target.value;
        setName(value);
        onDirtyChange?.(!!value);
        if (error) setError(value.trim() ? null : 'Enter a type name.');
      }}
      onBlur={() => {
        if (!name.trim()) setError('Enter a type name.');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void save();
        }
      }}
    />
  );
  const saveButton = (
    <button
      type="button"
      className={buttonStyles({
        variant: 'secondary',
        className: compact ? 'w-full md:w-fit' : '',
      })}
      disabled={pending}
      aria-busy={pending}
      onClick={() => void save()}
    >
      {pending ? 'Adding type…' : 'Save type'}
    </button>
  );
  if (compact)
    return (
      <div className="grid min-w-0 gap-2">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <div className="grid min-w-0 gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label
                className="text-label font-semibold text-ink"
                htmlFor={fieldId}
              >
                New type name
              </label>
              {inlineError ? (
                <span
                  id={`${fieldId}-error`}
                  role="alert"
                  className="max-w-full text-right text-xs leading-4 font-medium text-danger sm:max-w-[65%]"
                  title={error ?? undefined}
                >
                  {inlineError}
                </span>
              ) : null}
            </div>
            {input}
          </div>
          {saveButton}
          <button
            type="button"
            className={buttonStyles({
              variant: 'quiet',
              className: 'w-full md:w-fit',
            })}
            disabled={pending}
            onClick={onDiscard}
          >
            Discard
          </button>
        </div>
        <p id={`${fieldId}-hint`} className="text-xs leading-5 text-muted">
          Available across all branches in this organization.
        </p>
      </div>
    );
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        New type name
        {input}
      </label>
      <p className="text-sm text-muted">
        Available across all branches in this organization.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saveButton}
    </div>
  );
}
