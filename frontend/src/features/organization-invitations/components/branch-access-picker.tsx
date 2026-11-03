'use client';

import { useEffect, useState } from 'react';
import { InputControl } from '@/shared/components/ui/input-control';
import { Icon } from '@/shared/components/ui/icon';
import { buttonStyles } from '@/shared/components/ui/button';
import type { PagedOptionResult } from '@/shared/components/ui/paged-option-select';
import type { AccessBranch } from '@/features/organization-members/model/member-access.schemas';

const maxBranchAssignments = 100;

export function BranchAccessPicker({
  branches,
  loadPage,
  selectedIds,
  disabled = false,
  loading = false,
  description = 'Staff can access only the branches selected here.',
  onChange,
}: {
  branches: AccessBranch[];
  loadPage?: (query: string, page: number) => Promise<PagedOptionResult>;
  selectedIds: string[];
  disabled?: boolean;
  loading?: boolean;
  description?: string;
  onChange(nextIds: string[]): void;
}) {
  const [query, setQuery] = useState('');
  const [pagedBranches, setPagedBranches] = useState<
    PagedOptionResult['items']
  >([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingPage, setLoadingPage] = useState(Boolean(loadPage));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const localBranches = branches
    .filter((branch) =>
      `${branch.name} ${branch.code ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    )
    .map((branch) => ({
      id: branch.id,
      label: branch.code ? `${branch.name} · ${branch.code}` : branch.name,
    }));
  const visibleBranches = loadPage ? pagedBranches : localBranches;
  const selectedCount = selectedIds.length;

  useEffect(() => {
    if (!loadPage) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingPage(true);
      setLoadError(null);
      void loadPage(query.trim(), 1)
        .then((result) => {
          if (!active) return;
          setPagedBranches(result.items);
          setPage(1);
          setHasNext(result.hasNext);
        })
        .catch(() => {
          if (active) {
            setPagedBranches([]);
            setPage(1);
            setHasNext(false);
            setLoadError('Branches could not be loaded. Try again.');
          }
        })
        .finally(() => {
          if (active) setLoadingPage(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadPage, query, retry]);

  if (loading) {
    return (
      <div
        className="mt-3 grid gap-3"
        role="status"
        aria-label="Loading branches"
        aria-busy="true"
      >
        <span className="sr-only">Loading branches…</span>
        <div className="flex items-center justify-between gap-3 rounded-control border border-hairline bg-subtle px-3 py-2.5">
          <div className="grid min-w-0 gap-2">
            <span className="h-4 w-32 animate-pulse rounded-full bg-selected" />
            <span className="h-3 w-56 max-w-full animate-pulse rounded-full bg-selected" />
          </div>
          <span className="h-7 w-12 animate-pulse rounded-full bg-selected" />
        </div>
        <div className="grid gap-1.5 rounded-control border border-hairline bg-surface p-1.5">
          {[0, 1, 2].map((item) => (
            <div
              className="flex min-h-12 items-center gap-3 rounded-compact px-3 py-2"
              key={item}
            >
              <span className="size-7 shrink-0 animate-pulse rounded-full bg-selected" />
              <span className="h-4 w-32 animate-pulse rounded-full bg-selected" />
            </div>
          ))}
        </div>
        <span className="h-3 w-24 animate-pulse rounded-full bg-selected" />
      </div>
    );
  }

  async function loadMore() {
    if (!loadPage || loadingPage || !hasNext) return;
    setLoadingPage(true);
    setLoadError(null);
    try {
      const result = await loadPage(query.trim(), page + 1);
      setPagedBranches((current) => [
        ...current,
        ...result.items.filter(
          (item) => !current.some(({ id }) => id === item.id),
        ),
      ]);
      setPage((current) => current + 1);
      setHasNext(result.hasNext);
    } catch {
      setLoadError('More branches could not be loaded.');
    } finally {
      setLoadingPage(false);
    }
  }

  function toggleBranch(branchId: string) {
    onChange(
      selectedIds.includes(branchId)
        ? selectedIds.filter((id) => id !== branchId)
        : [...selectedIds, branchId],
    );
  }

  return (
    <div className="mt-3 grid gap-3">
      <div className="flex items-center justify-between gap-3 rounded-control border border-hairline bg-subtle px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
            <Icon name="building" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {selectedCount
                ? `${selectedCount} branch${selectedCount === 1 ? '' : 'es'} selected`
                : 'No branches selected'}
            </p>
            <p className="text-xs leading-5 text-muted">{description}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear branch selection"
          disabled={disabled || selectedCount === 0}
          onClick={() => onChange([])}
        >
          Clear
        </button>
      </div>
      <InputControl
        type="search"
        aria-label="Filter branches"
        placeholder="Search branches"
        value={query}
        disabled={disabled}
        icon="search"
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading || loadingPage ? (
        <div
          className="grid gap-1.5 rounded-control border border-hairline bg-surface p-1.5"
          role="status"
          aria-label="Loading branches"
          aria-busy="true"
        >
          {[0, 1, 2].map((item) => (
            <div
              className="flex min-h-12 items-center gap-3 rounded-compact px-3 py-2"
              key={item}
            >
              <span className="size-7 shrink-0 animate-pulse rounded-full bg-selected" />
              <span className="h-4 w-32 animate-pulse rounded-full bg-selected" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="grid gap-2 rounded-control border border-hairline bg-subtle px-3 py-3">
          <p className="text-sm text-danger" role="alert">
            {loadError}
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
      ) : visibleBranches.length ? (
        <>
          <div
            className="max-h-60 overflow-y-auto overscroll-contain rounded-control border border-hairline bg-surface p-1.5"
            role="group"
            aria-label="Available branches"
          >
            {visibleBranches.map((branch) => {
              const selected = selectedIds.includes(branch.id);
              const atLimit =
                !selected && selectedCount >= maxBranchAssignments;
              return (
                <button
                  key={branch.id}
                  type="button"
                  className={`flex min-h-12 w-full items-center gap-3 rounded-compact px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${selected ? 'bg-selected text-ink' : 'text-ink hover:bg-subtle'} disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-pressed={selected}
                  disabled={disabled || atLimit}
                  onClick={() => toggleBranch(branch.id)}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border ${selected ? 'border-selected bg-surface text-ink' : 'border-control-border text-transparent'}`}
                    aria-hidden="true"
                  >
                    <Icon name="check" className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {branch.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    {selected
                      ? 'Selected'
                      : atLimit
                        ? 'Limit reached'
                        : 'Select'}
                  </span>
                </button>
              );
            })}
          </div>
          {loadPage && hasNext ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={disabled || loadingPage}
              onClick={() => void loadMore()}
            >
              {loadingPage ? 'Loading more…' : 'Load more branches'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="rounded-control border border-hairline bg-subtle px-3 py-3 text-sm text-muted">
          No branches available. Access can be assigned later.
        </p>
      )}
      <p className="text-xs text-muted">
        {selectedCount}/{maxBranchAssignments} selected
      </p>
    </div>
  );
}
