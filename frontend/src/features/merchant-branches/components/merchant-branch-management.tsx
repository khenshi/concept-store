'use client';
import { occupiedSpaceCount } from '@/features/spaces/api/space-api';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { Icon } from '@/shared/components/ui/icon';
import { InputControl } from '@/shared/components/ui/input-control';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import {
  listAssociations,
  saveAssociation,
  type AssociationScope,
} from '../api/merchant-branch-api';
import type {
  MerchantBranch,
  MerchantBranchPage,
} from '../model/merchant-branch.schemas';

type Choice = { id: string; name: string; code: string | null };
export function MerchantBranchManagement(
  props: AssociationScope & { onChanged?(): void },
) {
  const { organization } = useOrganizationWorkspaceContext();
  if (
    !organization ||
    !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
  )
    return null;
  return (
    <AssociationSection
      key={`${props.organizationId}:${props.kind}:${props.id}:${organization.role}`}
      {...props}
    />
  );
}
function AssociationSection(scope: AssociationScope & { onChanged?(): void }) {
  const { request } = useAuth();
  const { organization, loadBranches } = useOrganizationWorkspaceContext();
  const owner = organization?.role === 'OWNER';
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [data, setData] = useState<MerchantBranchPage | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [choiceRevision, setChoiceRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const title = scope.kind === 'merchant' ? 'Branches' : 'Merchants';
  const { organizationId, kind, id } = scope;
  useEffect(() => {
    const read = ++generation.current;
    void Promise.resolve()
      .then(() => {
        if (read === generation.current) {
          setData(null);
          setError(null);
        }
        return listAssociations(
          request,
          { organizationId, kind, id },
          { page, q, status },
        );
      })
      .then((result) => {
        if (read === generation.current) setData(result);
      })
      .catch((cause: unknown) => {
        if (read === generation.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Associations could not be loaded.',
          );
      });
    return () => {
      generation.current = read + 1;
    };
  }, [
    request,
    organizationId,
    kind,
    id,
    organization,
    page,
    q,
    status,
    revision,
  ]);
  useEffect(() => {
    if (!assigning) return;
    let active = true;
    void Promise.resolve()
      .then(async () => {
        setChoices(null);
        setChoiceError(null);
        setSelected('');
        const existing = new Set<string>();
        let nextPage = 1;
        while (active) {
          const rows = await listAssociations(
            request,
            { organizationId, kind, id },
            { page: nextPage },
          );
          rows.items.forEach((row) =>
            existing.add(kind === 'merchant' ? row.branchId : row.merchantId),
          );
          if (!rows.hasNext) break;
          nextPage++;
        }
        const candidates =
          kind === 'merchant'
            ? await listBranches(request, organizationId)
            : await listMerchants(request, organizationId, {}, 'OWNER');
        if (active)
          setChoices(candidates.filter((choice) => !existing.has(choice.id)));
      })
      .catch((cause: unknown) => {
        if (active)
          setChoiceError(
            cause instanceof Error
              ? cause.message
              : 'Assignment choices could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [assigning, choiceRevision, request, organizationId, kind, id]);
  async function write(candidate: string, nextStatus?: 'ACTIVE' | 'INACTIVE') {
    if (!owner || lock.current) return;
    lock.current = true;
    const read = generation.current;
    try {
      setPending(true);
      const merchantId = kind === 'merchant' ? id : candidate;
      const branchId = kind === 'branch' ? id : candidate;
      const occupied =
        nextStatus === 'INACTIVE'
          ? await occupiedSpaceCount(
              request,
              organizationId,
              merchantId,
              branchId,
            )
          : 0;
      if (
        nextStatus &&
        !(await confirm({
          title:
            nextStatus === 'INACTIVE'
              ? 'Deactivate branch participation?'
              : 'Reactivate branch participation?',
          description:
            nextStatus === 'INACTIVE'
              ? `New placements, receiving and POS sales will stop. All ${occupied} occupied spaces in this branch will be released. Existing stock, corrections, refunds and history remain available.`
              : 'New placements, receiving and sales become available when the merchant and product are active.',
          confirmLabel: nextStatus === 'INACTIVE' ? 'Deactivate' : 'Reactivate',
          tone: nextStatus === 'INACTIVE' ? 'danger' : 'primary',
        }))
      )
        return;
      if (read !== generation.current) return;
      setPending(true);
      setError(null);
      setSuccess(null);
      await saveAssociation(
        request,
        organizationId,
        merchantId,
        branchId,
        nextStatus,
      );
      if (read !== generation.current) return;
      setAssigning(false);
      scope.onChanged?.();
      setSuccess(
        nextStatus
          ? `Participation is now ${nextStatus.toLowerCase()}.`
          : 'Branch assignment saved.',
      );
      setRevision((value) => value + 1);
      void loadBranches({ refresh: true }).catch(() => {});
    } catch (cause: unknown) {
      if (read === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The association could not be saved.',
        );
    } finally {
      lock.current = false;
      if (read === generation.current) setPending(false);
    }
  }
  const related = (row: MerchantBranch) =>
    kind === 'merchant' ? row.branch : row.merchant;
  return (
    <section
      className="mt-8 min-w-0 bg-surface py-6"
      aria-label={`${title} participation`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {owner && (
          <button
            type="button"
            className={buttonStyles({ variant: 'secondary' })}
            disabled={pending}
            onClick={() => setAssigning(true)}
          >
            Assign {kind === 'merchant' ? 'branch' : 'merchant'}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Branch participation is shared by all users linked to the merchant
        profile. Inactive participation preserves stock and history.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <label
          className="grid flex-1 gap-1 text-sm"
          htmlFor="association-search"
        >
          Search {title.toLowerCase()}
          <InputControl
            id="association-search"
            icon="search"
            value={q}
            disabled={pending}
            maxLength={120}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="association-status">
          Participation
          <span className="relative block min-w-0">
            <Icon
              name="filter"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            />
            <select
              id="association-status"
              className="min-h-11 w-full rounded-full border border-control-border bg-surface px-3 !pl-10 text-ink"
              value={status}
              disabled={pending}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </span>
        </label>
      </div>
      {success && (
        <p className="mt-4 text-sm text-success-ink" role="status">
          {success}
        </p>
      )}
      {error && (
        <div className="mt-4" role="alert">
          <p className="text-danger">{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: 'quiet' })}
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry associations
          </button>
        </div>
      )}
      {!data && !error && (
        <p className="mt-5 text-sm text-muted" role="status">
          Loading associations…
        </p>
      )}
      {data && (
        <>
          <ul className="mt-5 list-none p-0">
            {data.items.map((row) => (
              <li
                key={row.id}
                className="data-row flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">{related(row).name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {related(row).code ?? 'No code'} ·{' '}
                    {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className={buttonStyles({ variant: 'quiet' })}
                    href={`/app/organizations/${organizationId}/branches/${row.branchId}/inventory`}
                  >
                    View inventory
                  </Link>
                  {owner && (
                    <button
                      type="button"
                      disabled={pending}
                      className={buttonStyles({ variant: 'quiet' })}
                      onClick={() =>
                        void write(
                          kind === 'merchant' ? row.branchId : row.merchantId,
                          row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        )
                      }
                    >
                      {row.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!data.items.length ? (
            <EmptyState
              className="mt-5"
              title={`No ${q || status ? 'matching ' : ''}associations.`}
              description={
                owner
                  ? 'Assign a merchant to a branch to begin.'
                  : 'Ask an owner to configure branch participation.'
              }
            />
          ) : null}
          <PaginationControls
            className="px-0 py-4"
            ariaLabel="Merchant branch associations pagination"
            currentPage={data.page}
            totalPages={data.totalPages}
            pending={pending}
            hasNext={data.hasNext}
            summary={`${data.total} associations`}
            onPrevious={() => setPage((value) => value - 1)}
            onNext={() => setPage((value) => value + 1)}
          />
        </>
      )}
      {assigning && (
        <FormDialog
          title={`Assign ${kind === 'merchant' ? 'branch' : 'merchant'}`}
          description="Choose where this merchant operates. All linked merchant users inherit access."
          pending={pending}
          onClose={() => setAssigning(false)}
        >
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) void write(selected);
            }}
          >
            {choiceError && (
              <div role="alert">
                <p className="text-danger">{choiceError}</p>
                <button
                  type="button"
                  className={buttonStyles({ variant: 'quiet' })}
                  onClick={() => setChoiceRevision((value) => value + 1)}
                >
                  Retry choices
                </button>
              </div>
            )}
            <label
              className="grid gap-2 text-sm font-semibold"
              htmlFor="association-choice"
            >
              {kind === 'merchant' ? 'Branch' : 'Merchant'}
              <span className="relative block min-w-0">
                <Icon
                  name={kind === 'merchant' ? 'building' : 'account'}
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                />
                <select
                  id="association-choice"
                  className="min-h-11 w-full rounded-full border border-control-border bg-surface px-3 !pl-10 text-ink"
                  required
                  value={selected}
                  disabled={pending || !choices}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">
                    Choose {kind === 'merchant' ? 'a branch' : 'a merchant'}
                  </option>
                  {choices?.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                      {choice.code ? ` · ${choice.code}` : ''}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            {!choices && !choiceError && (
              <p role="status">Loading assignment choices…</p>
            )}
            {choices?.length === 0 && (
              <p>
                No unassigned choices remain. Existing inactive associations can
                be reactivated.
              </p>
            )}
            <ModalActionRow
              feedback={
                error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null
              }
            >
              <button
                type="button"
                disabled={pending}
                className={buttonStyles({ variant: 'secondary' })}
                onClick={() => setAssigning(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !selected || !choices}
                className={buttonStyles({ variant: 'primary' })}
              >
                {pending ? 'Assigning…' : 'Assign'}
              </button>
            </ModalActionRow>
          </form>
        </FormDialog>
      )}
      {confirmationDialog}
    </section>
  );
}
