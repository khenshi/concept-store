'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { listMerchants } from '@/features/merchants/merchant-api';
import type { Merchant } from '@/features/merchants/merchant.types';
import type { Space } from '../space.types';
import {
  createSpaceAssignment,
  endSpaceAssignment,
  listSpaceAssignments,
} from './space-assignment-api';
import {
  createSpaceAssignmentSchema,
  endSpaceAssignmentSchema,
} from './space-assignment.schemas';
import type { SpaceAssignment } from './space-assignment.types';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function businessDate(value: string): string {
  const date = value.slice(0, 10);
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

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
  const [assignments, setAssignments] = useState<SpaceAssignment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const eligibleMerchants = useMemo(
    () =>
      merchants.filter(
        (merchant) =>
          merchant.status === 'ACTIVE' &&
          merchant.branches.some((branch) => branch.id === space.branchId),
      ),
    [merchants, space.branchId],
  );
  const currentAssignment = assignments.find(
    (assignment) => assignment.endDate === null,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [assignmentResult, merchantResult] = await Promise.all([
        listSpaceAssignments(request, organizationId, space.id),
        listMerchants(request, organizationId),
      ]);
      setAssignments(assignmentResult);
      setMerchants(merchantResult);
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request, space.id]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listSpaceAssignments(request, organizationId, space.id),
      listMerchants(request, organizationId),
    ])
      .then(([assignmentResult, merchantResult]) => {
        if (!active) return;
        setAssignments(assignmentResult);
        setMerchants(merchantResult);
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
  }, [organizationId, request, space.id]);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = createSpaceAssignmentSchema.safeParse({
      merchantId: formData.get('merchantId'),
      startDate: formData.get('startDate'),
    });
    setActionError(null);
    setSuccessMessage(null);
    if (!result.success) {
      setActionError(result.error.issues[0]?.message ?? 'Review the form.');
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem(
          String(result.error.issues[0]?.path[0] ?? ''),
        );
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createSpaceAssignment(
        request,
        organizationId,
        space.id,
        result.data,
      );
      setAssignments((current) => [created, ...current]);
      setSuccessMessage(
        `${created.merchant.name} was assigned to ${space.name}.`,
      );
      form.reset();
      await onChanged?.();
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentAssignment) return;
    const form = event.currentTarget;
    const result = endSpaceAssignmentSchema.safeParse({
      endDate: new FormData(form).get('endDate'),
    });
    setActionError(null);
    setSuccessMessage(null);
    if (!result.success) {
      setActionError(result.error.issues[0]?.message ?? 'Enter an end date.');
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem('endDate');
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }
    if (result.data.endDate < currentAssignment.startDate.slice(0, 10)) {
      setActionError('End date cannot be earlier than the start date.');
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem('endDate');
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }
    if (
      !(await confirm({
        title: 'End this space assignment?',
        description: `End ${currentAssignment.merchant.name}'s assignment on the selected date. Assignment history will be preserved.`,
        confirmLabel: 'End assignment',
        tone: 'danger',
      }))
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const ended = await endSpaceAssignment(
        request,
        organizationId,
        currentAssignment.id,
        result.data,
      );
      setAssignments((current) =>
        current.map((assignment) =>
          assignment.id === ended.id ? ended : assignment,
        ),
      );
      setSuccessMessage(
        `${ended.merchant.name}'s assignment ended on ${businessDate(ended.endDate ?? result.data.endDate)}.`,
      );
      form.reset();
      await onChanged?.();
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="mt-5 rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="assignment-title"
    >
      <div className="flex items-start justify-between gap-4 max-sm:grid">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
            {space.code}
          </p>
          <h2
            className="mt-1 text-lg font-bold"
            id="assignment-title"
            ref={headingRef}
            tabIndex={-1}
          >
            {space.name} occupancy
          </h2>
          <p className="mt-2 leading-7 text-slate-500">
            Assign one participating merchant at a time and preserve previous
            occupancy.
          </p>
        </div>
        <button
          className="w-fit cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {isLoading ? (
        <ListSkeleton label="Loading space assignment history" />
      ) : loadError ? (
        <RequestError
          className="mt-5"
          title="Assignment history unavailable"
          message={loadError}
          onRetry={() => void load()}
        />
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
          <div className="grid gap-5">
            {successMessage ? (
              <p
                className="rounded-lg border border-green-600 bg-white px-4 py-3"
                role="status"
              >
                {successMessage}
              </p>
            ) : null}
            {actionError ? (
              <p
                className="rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}

            {currentAssignment ? (
              <CurrentAssignment
                assignment={currentAssignment}
                isSubmitting={isSubmitting}
                onSubmit={handleEnd}
              />
            ) : (
              <AssignmentForm
                merchants={eligibleMerchants}
                spaceIsActive={space.status === 'ACTIVE'}
                isSubmitting={isSubmitting}
                onSubmit={handleAssign}
              />
            )}
          </div>

          <AssignmentHistory assignments={assignments} />
        </div>
      )}
      {confirmationDialog}
    </section>
  );
}

function AssignmentForm({
  merchants,
  spaceIsActive,
  isSubmitting,
  onSubmit,
}: {
  merchants: Merchant[];
  spaceIsActive: boolean;
  isSubmitting: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  const canAssign = spaceIsActive && merchants.length > 0;
  return (
    <section aria-labelledby="assign-space-title">
      <h3 className="text-base font-bold" id="assign-space-title">
        New assignment
      </h3>
      {!spaceIsActive ? (
        <p className="mt-2 leading-7 text-slate-500">
          Activate this space before assigning a merchant.
        </p>
      ) : merchants.length === 0 ? (
        <p className="mt-2 leading-7 text-slate-500">
          No active merchants currently participate in this branch.
        </p>
      ) : null}
      <form className="mt-4 grid gap-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="assignment-merchant">
            Merchant
          </label>
          <SelectControl
            className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
            id="assignment-merchant"
            name="merchantId"
            defaultValue=""
            required
            disabled={!canAssign}
          >
            <option value="" disabled>
              Select a merchant
            </option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
                {merchant.code ? ` (${merchant.code})` : ''}
              </option>
            ))}
          </SelectControl>
        </div>
        <DateField
          id="assignment-start-date"
          name="startDate"
          label="Start date"
          disabled={!canAssign}
        />
        <button
          className="min-h-11 w-fit cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-65"
          type="submit"
          disabled={!canAssign || isSubmitting}
        >
          {isSubmitting ? 'Assigning merchant…' : 'Assign merchant'}
        </button>
      </form>
    </section>
  );
}

function CurrentAssignment({
  assignment,
  isSubmitting,
  onSubmit,
}: {
  assignment: SpaceAssignment;
  isSubmitting: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  return (
    <section aria-labelledby="current-assignment-title">
      <h3 className="text-base font-bold" id="current-assignment-title">
        Current assignment
      </h3>
      <div className="mt-4 rounded-[0.6rem] border border-slate-200 p-4">
        <strong>{assignment.merchant.name}</strong>
        {assignment.merchant.code ? (
          <p className="mt-1 text-sm text-slate-500">
            {assignment.merchant.code}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-500">
          Started {businessDate(assignment.startDate)}
        </p>
      </div>
      <form className="mt-4 grid gap-4" onSubmit={onSubmit} noValidate>
        <DateField
          id="assignment-end-date"
          name="endDate"
          label="End date"
          min={assignment.startDate.slice(0, 10)}
        />
        <button
          className="min-h-10 w-fit cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold disabled:cursor-wait disabled:opacity-65"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Ending assignment…' : 'End assignment'}
        </button>
      </form>
    </section>
  );
}

function AssignmentHistory({
  assignments,
}: {
  assignments: SpaceAssignment[];
}) {
  return (
    <section aria-labelledby="assignment-history-title">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-bold" id="assignment-history-title">
          Assignment history
        </h3>
        <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
          {assignments.length}
        </span>
      </div>
      {assignments.length === 0 ? (
        <p className="mt-4 leading-7 text-slate-500">
          This space has no assignment history yet.
        </p>
      ) : (
        <ul className="mt-4 list-none divide-y divide-slate-200 p-0">
          {assignments.map((assignment) => (
            <li
              className="flex justify-between gap-4 py-4 first:pt-0 max-sm:grid"
              key={assignment.id}
            >
              <div>
                <strong>{assignment.merchant.name}</strong>
                {assignment.merchant.code ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {assignment.merchant.code}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-slate-500 sm:text-right">
                {businessDate(assignment.startDate)} –{' '}
                {assignment.endDate
                  ? businessDate(assignment.endDate)
                  : 'Current'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DateField({
  id,
  name,
  label,
  disabled = false,
  min,
}: {
  id: string;
  name: 'startDate' | 'endDate';
  label: string;
  disabled?: boolean;
  min?: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <input
        className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
        id={id}
        name={name}
        type="date"
        required
        disabled={disabled}
        min={min}
      />
    </div>
  );
}
