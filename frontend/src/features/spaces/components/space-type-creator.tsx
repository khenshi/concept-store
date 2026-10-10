'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { createSpaceType } from '../api/space-api';
import type { SpaceType } from '../model/space.schemas';

export function SpaceTypeCreator({
  organizationId,
  onCreated,
  onPendingChange,
  onDirtyChange,
}: {
  organizationId: string;
  onCreated(type: SpaceType): void;
  onPendingChange?(pending: boolean): void;
  onDirtyChange?(dirty: boolean): void;
}) {
  const { request } = useAuth();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) {
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
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        New type name
        <input
          className="min-h-11 w-full rounded-control border border-control-border bg-surface px-3"
          maxLength={80}
          value={name}
          disabled={pending}
          onChange={(event) => {
            setName(event.target.value);
            onDirtyChange?.(!!event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
          }}
        />
      </label>
      <p className="text-sm text-muted">
        Available across all branches in this organization.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        className={buttonStyles({ variant: 'secondary' })}
        disabled={pending}
        aria-busy={pending}
        onClick={() => void save()}
      >
        {pending ? 'Adding type…' : 'Save type'}
      </button>
    </div>
  );
}
