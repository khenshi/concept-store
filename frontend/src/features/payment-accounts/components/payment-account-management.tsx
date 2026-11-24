'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import { BranchAccessPicker } from '@/features/organization-invitations/components/branch-access-picker';
import { listBranchOptions } from '@/features/branches/api/branch-api';
import type { BranchView } from '@/features/branches/model/branch.types';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import {
  FilterField,
  OperationalCollection,
} from '@/shared/components/ui/operational-page';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { InputControl } from '@/shared/components/ui/input-control';
import { TextField } from '@/shared/components/ui/text-field';
import { SelectControl } from '@/shared/components/ui/select-control';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { FloatingNotice } from '@/shared/components/ui/floating-notice';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  PagedOptionSelect,
  type PagedOption,
} from '@/shared/components/ui/paged-option-select';
import {
  createPaymentAccount,
  listPaymentAccounts,
  updatePaymentAccount,
} from '../api/payment-account-api';
import {
  validPaymentAccountInput,
  type PaymentAccount,
  type PaymentAccountInput,
} from '../model/payment-account';

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Payment accounts could not be loaded. Please try again.';
}

export function PaymentAccountManagement({
  organizationId,
}: {
  organizationId: string;
}) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedPaymentAccounts
      key={`${organizationId}:${organization?.role}`}
      organizationId={organizationId}
    />
  );
}

function ScopedPaymentAccounts({ organizationId }: { organizationId: string }) {
  const { request } = useAuth();
  const { organization, organizationStatus, branches, loadBranches } =
    useOrganizationWorkspaceContext();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [branchOption, setBranchOption] = useState<PagedOption | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PaymentAccount | 'new' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const readOnly = organization?.status === 'INACTIVE';
  const loadBranchPage = useCallback(
    (query: string, optionPage: number) =>
      listBranchOptions(request, organizationId, {
        search: query,
        page: optionPage,
      }),
    [organizationId, request],
  );

  useEffect(() => {
    if (organization?.role !== 'OWNER') return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        const [result] = await Promise.all([
          listPaymentAccounts(request, organizationId),
          loadBranches(),
        ]);
        if (active) setAccounts(result);
      } catch (cause) {
        if (active) setError(message(cause));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [organization?.role, organizationId, request, loadBranches, revision]);

  if (organizationStatus === 'loading')
    return (
      <OrganizationPageFrame>
        <ListSkeleton label="Loading payment accounts" />
      </OrganizationPageFrame>
    );
  if (!organization || organization.role !== 'OWNER')
    return (
      <OrganizationPageFrame>
        <EmptyState
          title="Owner access required"
          description="Only organization Owners can manage payment accounts."
        />
      </OrganizationPageFrame>
    );
  const filtered = accounts.filter(
    (account) =>
      account.name
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!status || account.enabled === (status === 'enabled')) &&
      (!branch ||
        account.assignmentMode === 'ALL' ||
        account.branchIds.includes(branch)),
  );
  const totalPages = Math.ceil(filtered.length / 15);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const visible = filtered.slice((currentPage - 1) * 15, currentPage * 15);

  return (
    <OrganizationPageFrame>
      <OrganizationPageHeader
        organization={organization}
        title="Payment Accounts"
        description="Choose where each account can receive payments and refunds. Historical transactions keep their original account details."
      />
      {success ? (
        <FloatingNotice
          key={success}
          message={success}
          onDismiss={() => setSuccess(null)}
        />
      ) : null}
      {readOnly ? (
        <p className="mt-5 text-sm text-muted">
          This organization is inactive. Account configuration is read-only.
        </p>
      ) : null}
      <OperationalCollection
        title="Accounts"
        action={
          <Button
            variant="accent"
            disabled={readOnly || loading}
            onClick={() => setEditing('new')}
          >
            Create account
          </Button>
        }
        controls={
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_14rem]">
            <FilterField id="account-search" label="Search">
              <InputControl
                id="account-search"
                type="search"
                placeholder="Search payment accounts"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </FilterField>
            <FilterField id="account-status" label="Availability">
              <SelectControl
                id="account-status"
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <option value="">All accounts</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </SelectControl>
            </FilterField>
            <FilterField id="account-branch" label="Branch">
              <PagedOptionSelect
                id="account-branch"
                value={branch}
                selectedOption={branchOption}
                placeholder="All branches"
                loadPage={loadBranchPage}
                onValueChange={(value) => {
                  setBranch(value);
                  setPage(1);
                }}
                onOptionChange={setBranchOption}
              />
            </FilterField>
          </div>
        }
      >
        {loading ? (
          <div className="px-6 pb-6">
            <ListSkeleton label="Loading payment accounts" />
          </div>
        ) : error ? (
          <div className="p-6">
            <RequestError
              message={error}
              onRetry={() => setRevision((value) => value + 1)}
            />
          </div>
        ) : (
          <OperationalTableFrame
            empty={
              !visible.length ? (
                <EmptyState
                  title="No payment accounts match"
                  description="Try another search or change the filters."
                />
              ) : undefined
            }
            footer={
              <PaginationControls
                ariaLabel="Payment accounts pagination"
                currentPage={currentPage}
                totalPages={totalPages}
                hasNext={currentPage < totalPages}
                summary={`${filtered.length} account${filtered.length === 1 ? '' : 's'}`}
                onPrevious={() => setPage(currentPage - 1)}
                onNext={() => setPage(currentPage + 1)}
              />
            }
          >
            <OperationalTable className="min-w-[42rem] [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Availability</th>
                  <th>Branch assignment</th>
                  <th>Reference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <span className="font-semibold">{account.name}</span>
                      {account.systemKey ? (
                        <span className="ml-2 text-xs text-muted">System</span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${account.enabled ? 'border-success/30 bg-success/5 text-success-ink' : 'border-hairline bg-subtle text-muted'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${account.enabled ? 'bg-success' : 'bg-muted'}`}
                        />
                        {account.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {account.assignmentMode === 'ALL'
                        ? 'All current and future branches'
                        : account.branchIds
                            .map(
                              (id) =>
                                branches.find((item) => item.id === id)?.name ??
                                'Unavailable branch',
                            )
                            .join(', ')}
                    </td>
                    <td>
                      {account.systemKey === 'CASH'
                        ? 'Not used'
                        : account.requiresReference
                          ? 'Required'
                          : 'Optional'}
                    </td>
                    <td>
                      {account.systemKey ? (
                        <span className="text-xs text-muted">
                          Always available
                        </span>
                      ) : (
                        <Button
                          variant="quiet"
                          className="!border-0 text-sm font-semibold"
                          disabled={readOnly}
                          onClick={() => setEditing(account)}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </OperationalTable>
          </OperationalTableFrame>
        )}
      </OperationalCollection>
      {editing ? (
        <PaymentAccountForm
          key={editing === 'new' ? 'new' : editing.id}
          account={editing === 'new' ? null : editing}
          branches={branches}
          organizationId={organizationId}
          onClose={() => setEditing(null)}
          onSaved={(account) => {
            setAccounts((previous) =>
              [
                ...previous.filter((item) => item.id !== account.id),
                account,
              ].sort(
                (a, b) =>
                  Number(Boolean(b.systemKey)) - Number(Boolean(a.systemKey)) ||
                  a.name.localeCompare(b.name),
              ),
            );
            setEditing(null);
            setSuccess(
              `${account.name} saved. Changes apply to future transactions.`,
            );
          }}
        />
      ) : null}
    </OrganizationPageFrame>
  );
}

function PaymentAccountForm({
  account,
  branches,
  organizationId,
  onClose,
  onSaved,
}: {
  account: PaymentAccount | null;
  branches: BranchView[];
  organizationId: string;
  onClose(): void;
  onSaved(account: PaymentAccount): void;
}) {
  const { request } = useAuth();
  const initial: PaymentAccountInput = {
    name: account?.name ?? '',
    enabled: account?.enabled ?? true,
    requiresReference: account?.requiresReference ?? true,
    assignmentMode: account?.assignmentMode ?? 'SELECTED',
    branchIds: account?.branchIds ?? [],
  };
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = {
    ...draft,
    name: draft.name.trim(),
    branchIds:
      draft.assignmentMode === 'ALL' ? [] : [...draft.branchIds].sort(),
  };
  const baseline = { ...initial, branchIds: [...initial.branchIds].sort() };
  const changed = JSON.stringify(input) !== JSON.stringify(baseline);
  const valid =
    validPaymentAccountInput(input) &&
    input.name.toLocaleLowerCase() !== 'cash';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !valid || !changed) return;
    setPending(true);
    setError(null);
    try {
      const result = account
        ? await updatePaymentAccount(request, organizationId, account.id, {
            ...input,
            version: account.version,
          })
        : await createPaymentAccount(request, organizationId, input);
      onSaved(result);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      title={account ? 'Edit payment account' : 'Create payment account'}
      description="Changes apply to future payments and refunds. Saved transactions keep their original account details."
      size="medium"
      pending={pending}
      onClose={onClose}
    >
      <form
        className="mt-6 grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1.1fr)]"
        onSubmit={submit}
      >
        <div className="grid content-start gap-5">
          <TextField
            label="Account name"
            placeholder="GCash Main"
            maxLength={100}
            required
            value={draft.name}
            disabled={pending}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <FilterField id="payment-account-availability" label="Availability">
            <SelectControl
              id="payment-account-availability"
              value={draft.enabled ? 'enabled' : 'disabled'}
              disabled={pending}
              onValueChange={(value) =>
                setDraft({ ...draft, enabled: value === 'enabled' })
              }
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </SelectControl>
          </FilterField>
          <FilterField id="payment-account-reference" label="Account reference">
            <SelectControl
              id="payment-account-reference"
              value={draft.requiresReference ? 'required' : 'optional'}
              disabled={pending}
              onValueChange={(value) =>
                setDraft({ ...draft, requiresReference: value === 'required' })
              }
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </SelectControl>
          </FilterField>
        </div>
        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-4 rounded-control border border-control-border bg-subtle px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">All branches</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Allow this account in all current and future branches.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="All branches"
              aria-checked={draft.assignmentMode === 'ALL'}
              disabled={pending}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${draft.assignmentMode === 'ALL' ? 'border-ink bg-ink' : 'border-control-border bg-surface'}`}
              onClick={() =>
                setDraft({
                  ...draft,
                  assignmentMode:
                    draft.assignmentMode === 'ALL' ? 'SELECTED' : 'ALL',
                })
              }
            >
              <span
                aria-hidden="true"
                className={`size-5 rounded-full border border-control-border bg-surface transition-transform ${draft.assignmentMode === 'ALL' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          <BranchAccessPicker
            branches={branches}
            selectedIds={
              draft.assignmentMode === 'ALL'
                ? branches.map(({ id }) => id)
                : draft.branchIds
            }
            showSearch={false}
            fixedListHeight
            compactSelection
            disabled={pending || draft.assignmentMode === 'ALL'}
            description="Choose the branches where this payment account can be used."
            onChange={(branchIds) =>
              setDraft({ ...draft, assignmentMode: 'SELECTED', branchIds })
            }
          />
        </div>
        <ModalActionRow
          feedback={
            error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : undefined
          }
        >
          <Button
            variant="quiet"
            className="!border-0"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            type="submit"
            pending={pending}
            pendingLabel="Saving…"
            disabled={!valid || !changed}
          >
            Save account
          </Button>
        </ModalActionRow>
      </form>
    </FormDialog>
  );
}
