'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  PagedOptionSelect,
  type PagedOption,
  type PagedOptionResult,
} from '@/shared/components/ui/paged-option-select';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  listMemberBranches,
  setMemberBranch,
  setMemberMerchant,
  updateOrganizationMemberRole,
} from '../api/organization-member-api';
import type { OrganizationMember } from '../model/organization-member.types';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import {
  getMerchant,
  listMerchantOptions,
} from '@/features/merchants/api/merchant-api';
import { listBranchOptions } from '@/features/branches/api/branch-api';

const roles: OrganizationRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'MERCHANT'];

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
};

export function MemberAccessDialog({
  organizationId,
  member,
  onClose,
  onMemberChanged,
}: {
  organizationId: string;
  member: OrganizationMember;
  onClose(): void;
  onMemberChanged(member: OrganizationMember): void;
}) {
  const { request } = useAuth();
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loadedAccessKey, setLoadedAccessKey] = useState<string | null>(null);
  const [role, setRole] = useState<OrganizationRole>(member.role);
  const [merchantId, setMerchantId] = useState(member.merchantId ?? '');
  const [merchantOption, setMerchantOption] = useState<PagedOption | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    label: string;
    action(): Promise<void>;
    clearsScopedAccess?: boolean;
  } | null>(null);
  const safeFocus = useRef<HTMLButtonElement>(null);
  const roleChanged = role !== member.role;
  const isStaffRole = role === 'MANAGER' || role === 'CASHIER';
  const accessLoadKey = `${member.id}:${revision}`;
  const accessLoaded = loadedAccessKey === accessLoadKey;
  const loadMerchantPage = useCallback(
    (query: string, page: number) =>
      listMerchantOptions(
        request,
        organizationId,
        { search: query, page },
        'OWNER',
      ),
    [organizationId, request],
  );
  const loadBranchPage = useCallback(
    (query: string, page: number) =>
      listBranchOptions(request, organizationId, { search: query, page }),
    [organizationId, request],
  );

  useEffect(() => {
    if (confirmation) safeFocus.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    let active = true;
    void listMemberBranches(request, organizationId, member.id)
      .then((branches) => {
        if (active) {
          setAssigned(branches.map(({ id }) => id));
          setLoadedAccessKey(accessLoadKey);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Access settings could not be loaded. Try again.');
      });
    if (member.merchantId) {
      void getMerchant(request, organizationId, member.merchantId, 'OWNER')
        .then((merchant) => {
          if (active)
            setMerchantOption({ id: merchant.id, label: merchant.name });
        })
        .catch(() => {
          if (active) setMerchantOption(null);
        });
    }
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    member.id,
    member.merchantId,
    revision,
    accessLoadKey,
  ]);

  async function write(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setConfirmation(null);
      setNotice('Access updated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Access could not be updated. Try again.',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const updateRole = async () => {
    const updated = await updateOrganizationMemberRole(
      request,
      organizationId,
      member.id,
      role,
      role === 'MERCHANT' ? merchantId : undefined,
    );
    onMemberChanged(updated);
    onClose();
  };

  const updateMerchant = async () => {
    const updated = await setMemberMerchant(
      request,
      organizationId,
      member.id,
      merchantId,
    );
    onMemberChanged({ ...member, merchantId: updated.merchantId });
  };

  return (
    <FormDialog
      title={`Edit access for ${member.email}`}
      description="Change this account's role, branch access, or merchant profile."
      pending={pending}
      onClose={onClose}
    >
      {notice && (
        <p role="status" className="mt-4 text-sm text-muted">
          {notice}
        </p>
      )}
      {!accessLoaded ? (
        <div className="mt-4">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <p role="status">Loading access settings…</p>
          {error && (
            <button
              type="button"
              className={buttonStyles({ variant: 'secondary' })}
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      ) : confirmation ? (
        <section className="mt-5 grid gap-4" aria-label="Confirm access change">
          <h3>{confirmation.label}</h3>
          <p className="text-sm text-muted">
            This changes future access, not products, stock, or historical
            attribution.
            {confirmation.clearsScopedAccess
              ? ' Existing branch assignments and merchant links will be cleared.'
              : ''}
          </p>
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
              ref={safeFocus}
              type="button"
              disabled={pending}
              className={buttonStyles({ variant: 'quiet' })}
              onClick={() => {
                setConfirmation(null);
                setError(null);
              }}
            >
              Keep current access
            </button>
            <button
              type="button"
              disabled={pending}
              className={buttonStyles({ variant: 'danger' })}
              onClick={() => void write(confirmation.action)}
            >
              {pending ? 'Updating…' : 'Confirm change'}
            </button>
          </ModalActionRow>
        </section>
      ) : (
        <div className="mt-5 grid gap-6">
          <section className="grid gap-3">
            <label htmlFor="member-role" className="text-sm font-semibold">
              Organization role
            </label>
            <SelectControl
              id="member-role"
              value={role}
              disabled={pending}
              onValueChange={(value) => {
                setRole(value as OrganizationRole);
                setError(null);
              }}
            >
              {roles.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {roleLabels[candidate]}
                </option>
              ))}
            </SelectControl>
            {roleChanged ? (
              <>
                <p className="text-sm text-muted">
                  Changing the role clears current branch assignments and
                  merchant links. Save the role change before editing its new
                  access settings.
                </p>
                {role === 'MERCHANT' ? (
                  <MerchantProfileField
                    merchantId={merchantId}
                    merchantOption={merchantOption}
                    loadMerchantOptions={loadMerchantPage}
                    pending={pending}
                    onChange={setMerchantId}
                    onOptionChange={setMerchantOption}
                  />
                ) : null}
                {role === 'OWNER' ? (
                  <p className="text-sm text-muted">
                    Owners have access to all current and future branches.
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={pending || (role === 'MERCHANT' && !merchantId)}
                    className={buttonStyles({ variant: 'primary' })}
                    onClick={() =>
                      setConfirmation({
                        label: `Change role to ${roleLabels[role]}?`,
                        action: updateRole,
                        clearsScopedAccess: true,
                      })
                    }
                  >
                    Review role change
                  </button>
                </div>
              </>
            ) : null}
          </section>

          {!roleChanged && member.role === 'OWNER' ? (
            <p>Owners have access to all current and future branches.</p>
          ) : null}

          {!roleChanged && isStaffRole ? (
            <PagedBranchAssignments
              assigned={assigned}
              disabled={pending}
              loadPage={loadBranchPage}
              onToggle={(branch, granted) => {
                const action = async () => {
                  await setMemberBranch(
                    request,
                    organizationId,
                    member.id,
                    branch.id,
                    !granted,
                  );
                  const nextAssigned = granted
                    ? assigned.filter((id) => id !== branch.id)
                    : [...assigned, branch.id];
                  setAssigned(nextAssigned);
                  onMemberChanged({
                    ...member,
                    branchAccessCount: nextAssigned.length,
                  });
                };
                if (granted)
                  setConfirmation({
                    label: `Revoke ${branch.label}?`,
                    action,
                  });
                else void write(action);
              }}
            />
          ) : null}

          {!roleChanged && member.role === 'MERCHANT' ? (
            <>
              <p className="text-sm text-muted">
                This user inherits all branches associated with their merchant
                profile. Manage participation on the merchant profile.
              </p>
              <section className="grid gap-3">
                <MerchantProfileField
                  merchantId={merchantId}
                  merchantOption={merchantOption}
                  loadMerchantOptions={loadMerchantPage}
                  pending={pending}
                  onChange={setMerchantId}
                  onOptionChange={setMerchantOption}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={
                      pending || !merchantId || merchantId === member.merchantId
                    }
                    className={buttonStyles({ variant: 'primary' })}
                    onClick={() =>
                      setConfirmation({
                        label: 'Change the represented merchant?',
                        action: updateMerchant,
                      })
                    }
                  >
                    Review merchant link
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      )}
      <ModalActionRow
        className="mt-6"
        feedback={
          accessLoaded && !confirmation && error ? (
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
          onClick={onClose}
        >
          Done
        </button>
      </ModalActionRow>
    </FormDialog>
  );
}

function MerchantProfileField({
  merchantId,
  merchantOption,
  loadMerchantOptions,
  pending,
  onChange,
  onOptionChange,
}: {
  merchantId: string;
  merchantOption: PagedOption | null;
  loadMerchantOptions: (
    query: string,
    page: number,
  ) => Promise<{
    items: PagedOption[];
    hasNext: boolean;
  }>;
  pending: boolean;
  onChange(value: string): void;
  onOptionChange(option: PagedOption | null): void;
}) {
  return (
    <div className="grid gap-3">
      <label htmlFor="member-merchant" className="text-sm font-semibold">
        Merchant profile
      </label>
      <PagedOptionSelect
        id="member-merchant"
        value={merchantId}
        selectedOption={merchantOption}
        placeholder="Choose a merchant"
        searchPlaceholder="Search merchants"
        loadPage={loadMerchantOptions}
        disabled={pending}
        onValueChange={onChange}
        onOptionChange={onOptionChange}
      />
    </div>
  );
}

function PagedBranchAssignments({
  assigned,
  disabled,
  loadPage,
  onToggle,
}: {
  assigned: string[];
  disabled: boolean;
  loadPage: (query: string, page: number) => Promise<PagedOptionResult>;
  onToggle(branch: PagedOption, granted: boolean): void;
}) {
  const [query, setQuery] = useState('');
  const [branches, setBranches] = useState<PagedOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void loadPage(query.trim(), 1)
        .then((result) => {
          if (!active) return;
          setBranches(result.items);
          setPage(1);
          setHasNext(result.hasNext);
        })
        .catch(() => {
          if (active) {
            setBranches([]);
            setPage(1);
            setHasNext(false);
            setError('Branches could not be loaded. Try again.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadPage, query, retry]);

  async function loadMore() {
    if (loading || loadingMore || !hasNext) return;
    setLoadingMore(true);
    try {
      const result = await loadPage(query.trim(), page + 1);
      setBranches((current) => [
        ...current,
        ...result.items.filter(
          (item) => !current.some(({ id }) => id === item.id),
        ),
      ]);
      setPage((current) => current + 1);
      setHasNext(result.hasNext);
    } catch {
      setError('More branches could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section>
      <h3 className="text-base font-semibold">Branch assignments</h3>
      <p className="mt-2 text-sm text-muted">
        Changes save individually. Staff access is limited to assigned branches.
      </p>
      <input
        className="mt-3 min-h-11 w-full rounded-full border border-control-border bg-surface px-4 text-sm"
        type="search"
        aria-label="Search branches"
        placeholder="Search branches"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading ? (
        <p role="status" className="mt-3 text-sm text-muted">
          Loading branches…
        </p>
      ) : error ? (
        <div className="mt-3 grid gap-2">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            className={buttonStyles({ variant: 'quiet' })}
            disabled={disabled}
            onClick={() => setRetry((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      ) : branches.length ? (
        <>
          <ul className="mt-3 max-h-72 list-none divide-y divide-hairline overflow-y-auto p-0">
            {branches.map((branch) => {
              const granted = assigned.includes(branch.id);
              return (
                <li
                  key={branch.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 break-words">{branch.label}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    className={buttonStyles({ variant: 'secondary' })}
                    aria-label={`${granted ? 'Revoke' : 'Grant'} ${branch.label.split(' · ')[0]}`}
                    onClick={() => onToggle(branch, granted)}
                  >
                    {granted ? 'Revoke' : 'Grant'}
                  </button>
                </li>
              );
            })}
          </ul>
          {hasNext ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={disabled || loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Loading more…' : 'Load more branches'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No branches available.</p>
      )}
    </section>
  );
}
