'use client';
import { occupiedSpaceCount } from '@/features/spaces/api/space-api';
import { BranchAccessPicker } from '@/features/organization-invitations/components/branch-access-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listBranchOptions } from '@/features/branches/api/branch-api';
import { listMerchantOptions } from '@/features/merchants/api/merchant-api';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { InputControl } from '@/shared/components/ui/input-control';
import {
  FilterField,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import {
  PagedOptionSelect,
  type PagedOption,
} from '@/shared/components/ui/paged-option-select';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  listAssociations,
  saveAssociation,
  type AssociationScope,
} from '../api/merchant-branch-api';
import type {
  MerchantBranch,
  MerchantBranchPage,
} from '../model/merchant-branch.schemas';

const associationGrid = 'sm:grid-cols-[minmax(0,1fr)_8rem_18rem]';

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
  const [choicesReady, setChoicesReady] = useState(false);
  const [existingChoiceIds, setExistingChoiceIds] = useState<string[]>([]);
  const [choiceOption, setChoiceOption] = useState<PagedOption | null>(null);
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
        setChoicesReady(false);
        setExistingChoiceIds([]);
        setChoiceOption(null);
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
        if (active) {
          setExistingChoiceIds([...existing]);
          setChoicesReady(true);
        }
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
  const loadChoicePage = useCallback(
    (query: string, optionPage: number) =>
      (kind === 'merchant'
        ? listBranchOptions(request, organizationId, {
            search: query,
            page: optionPage,
          })
        : listMerchantOptions(
            request,
            organizationId,
            { search: query, page: optionPage },
            'OWNER',
          )
      ).then((result) => ({
        items: result.items.filter(
          (option) => !existingChoiceIds.includes(option.id),
        ),
        hasNext: result.hasNext,
      })),
    [existingChoiceIds, kind, organizationId, request],
  );
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
    <OperationalPanel
      className="mt-5 min-w-0"
      aria-label={`${title} participation`}
      title={title}
      description="Branch participation is shared by all users linked to the merchant profile. Inactive participation preserves stock and history."
      action={
        owner ? (
          <button
            type="button"
            className={buttonStyles({ variant: 'primary' })}
            disabled={pending}
            onClick={() => setAssigning(true)}
          >
            Assign {kind === 'merchant' ? 'branch' : 'merchant'}
          </button>
        ) : undefined
      }
    >
      <div className="px-5 pb-6 sm:px-6">
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <FilterField
              id="association-search"
              label={`Search ${title.toLowerCase()}`}
            >
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
            </FilterField>
          </div>
          <div className="min-w-48">
            <FilterField id="association-status" label="Participation">
              <SelectControl
                id="association-status"
                aria-label="Participation"
                value={status}
                disabled={pending}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectControl>
            </FilterField>
          </div>
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
            <div className="mt-5 -mx-5 overflow-x-auto sm:-mx-6">
              <ul className="list-none p-0" aria-label={`${title} table`}>
                <li
                  className={`data-column-header hidden gap-x-6 gap-y-3 sm:grid sm:!px-6 ${associationGrid}`}
                >
                  <span>{kind === 'merchant' ? 'Branch' : 'Merchant'}</span>
                  <span>Status</span>
                  <span>Actions</span>
                </li>
                {data.items.map((row) => (
                  <li
                    key={row.id}
                    className={`data-row grid min-w-0 gap-x-6 gap-y-3 !px-4 py-4 sm:items-center sm:!px-6 ${associationGrid}`}
                  >
                    <div className="min-w-0 break-words">
                      <p className="font-semibold">{related(row).name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {related(row).code ?? 'No code'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${row.status === 'ACTIVE' ? 'border-success/20 bg-success/5 text-success-ink' : 'border-danger/20 bg-danger/5 text-danger'}`}
                    >
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
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
                          className={buttonStyles({
                            variant: 'quiet',
                            className:
                              row.status === 'ACTIVE'
                                ? 'text-danger hover:text-danger'
                                : undefined,
                          })}
                          onClick={() =>
                            void write(
                              kind === 'merchant'
                                ? row.branchId
                                : row.merchantId,
                              row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            )
                          }
                        >
                          {row.status === 'ACTIVE'
                            ? 'Deactivate'
                            : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
      </div>
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
            {kind === 'merchant' ? (
              <div className="grid gap-2 text-sm font-semibold">
                <span>Branch</span>
                <BranchAccessPicker
                  branches={[]}
                  loadPage={loadChoicePage}
                  selectedIds={selected ? [selected] : []}
                  showSearch={false}
                  fixedListHeight
                  compactSelection
                  disabled={pending || !choicesReady}
                  description="Choose the branch where this merchant operates."
                  onChange={(branchIds) =>
                    setSelected(branchIds[branchIds.length - 1] ?? '')
                  }
                />
              </div>
            ) : (
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="association-choice"
              >
                Merchant
                <PagedOptionSelect
                  id="association-choice"
                  value={selected}
                  selectedOption={choiceOption}
                  placeholder="Choose a merchant"
                  searchPlaceholder="Search merchants"
                  emptyMessage="No unassigned choices remain. Existing inactive associations can be reactivated."
                  disabled={pending || !choicesReady}
                  loadPage={loadChoicePage}
                  onValueChange={setSelected}
                  onOptionChange={setChoiceOption}
                />
              </label>
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
                className={buttonStyles({ variant: 'quiet' })}
                onClick={() => setAssigning(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !selected || !choicesReady}
                className={buttonStyles({ variant: 'primary' })}
              >
                {pending ? 'Assigning…' : 'Assign'}
              </button>
            </ModalActionRow>
          </form>
        </FormDialog>
      )}
      {confirmationDialog}
    </OperationalPanel>
  );
}
