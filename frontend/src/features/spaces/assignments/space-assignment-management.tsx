'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Space } from '../space.types';
import {
  endSpaceAssignment,
  listSpaceAssignments,
} from './space-assignment-api';
import { endSpaceAssignmentSchema } from './space-assignment.schemas';
import type { SpaceAssignment } from './space-assignment.types';

const displayDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );

export function SpaceAssignmentManagement({
  organizationId,
  space,
  onClose,
  onChanged,
}: {
  organizationId: string;
  space: Space;
  onClose(): void;
  onChanged?(): void | Promise<void>;
}) {
  const { request } = useAuth();
  const [items, setItems] = useState<SpaceAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void listSpaceAssignments(request, organizationId, space.id)
      .then(setItems)
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Assignment history could not be loaded.',
        ),
      );
  }, [organizationId, request, space.id]);

  async function endLegacy(
    event: FormEvent<HTMLFormElement>,
    assignment: SpaceAssignment,
  ) {
    event.preventDefault();
    const result = endSpaceAssignmentSchema.safeParse({
      endDate: new FormData(event.currentTarget).get('endDate'),
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a valid date.');
      return;
    }
    setBusy(true);
    try {
      const ended = await endSpaceAssignment(
        request,
        organizationId,
        assignment.id,
        result.data,
      );
      setItems((current) =>
        current.map((item) => (item.id === ended.id ? ended : item)),
      );
      await onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The legacy assignment could not be ended.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4">
      <section className="mx-auto max-w-2xl rounded-xl bg-white p-6">
        <div className="flex justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">
              {space.code} assignment history
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              New occupancy is managed through merchant agreements.
            </p>
          </div>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
        {error ? <p className="mt-4 text-red-700">{error}</p> : null}
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <article
              className="rounded-lg border border-slate-200 p-4"
              key={item.id}
            >
              <div className="flex justify-between">
                <strong>{item.merchant.name}</strong>
                <span className="text-xs font-bold">
                  {item.agreementId ? 'AGREEMENT' : 'LEGACY'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {displayDate(item.startDate)} –{' '}
                {item.endDate ? displayDate(item.endDate) : 'Current'}
              </p>
              {!item.agreementId && !item.endDate ? (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(event) => void endLegacy(event, item)}
                >
                  <input
                    aria-label="Legacy assignment end date"
                    className="min-h-10 rounded border border-slate-300 px-2"
                    name="endDate"
                    type="date"
                    min={item.startDate.slice(0, 10)}
                    required
                  />
                  <button className="font-bold text-red-700" disabled={busy}>
                    End legacy assignment
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {!items.length ? (
            <p className="text-slate-500">No assignment history.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
