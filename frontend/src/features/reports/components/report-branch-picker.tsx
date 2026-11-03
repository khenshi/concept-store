'use client';
import { useCallback, useId } from 'react';
import { SelectControl } from '@/shared/components/ui/select-control';
import { PagedOptionSelect } from '@/shared/components/ui/paged-option-select';
import type { ReportBranch } from '../model/report.schemas';
import type { ReportScope } from '../model/report-scope';

export function ReportBranchPicker({
  branches,
  branchId = '',
  allBranches = false,
  allBranchesSelected = false,
  loading = branches === null,
  onChange,
  loadPage,
  compact = false,
}: {
  branches: ReportBranch[] | null;
  branchId?: string;
  allBranches?: boolean;
  allBranchesSelected?: boolean;
  loading?: boolean;
  onChange(scope: ReportScope): void;
  loadPage?: (
    query: string,
    page: number,
  ) => Promise<{ items: { id: string; label: string }[]; hasNext: boolean }>;
  compact?: boolean;
}) {
  const id = useId();
  const selected = branches?.find((branch) => branch.id === branchId);
  const loadOptions = useCallback(
    (query: string, page: number) =>
      loadPage!(query, page).then((result) => ({
        items: allBranches
          ? [{ id: 'ALL', label: 'All branches' }, ...result.items]
          : result.items,
        hasNext: result.hasNext,
      })),
    [allBranches, loadPage],
  );
  return (
    <div className={compact ? 'w-full min-w-56 max-w-sm' : 'my-6 max-w-xl'}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Reports branch
      </label>
      {loadPage ? (
        <PagedOptionSelect
          id={id}
          value={allBranchesSelected ? 'ALL' : branchId}
          selectedOption={
            allBranchesSelected
              ? { id: 'ALL', label: 'All branches' }
              : selected
                ? {
                    id: selected.id,
                    label: selected.code
                      ? `${selected.name} (${selected.code})`
                      : selected.name,
                  }
                : null
          }
          placeholder={loading ? 'Loading branches…' : 'Choose a branch'}
          loadPage={loadOptions}
          disabled={loading || branches === null}
          onValueChange={(next) => {
            if (allBranches && next === 'ALL' && !allBranchesSelected)
              onChange({ kind: 'all' });
            else if (
              next &&
              next !== branchId &&
              (selected?.id === next || next !== 'ALL')
            )
              onChange({ kind: 'branch', branchId: next });
          }}
        />
      ) : (
        <SelectControl
          id={id}
          value={
            allBranchesSelected
              ? 'ALL'
              : branches?.some((branch) => branch.id === branchId)
                ? branchId
                : ''
          }
          disabled={loading || branches === null}
          onValueChange={(next) => {
            if (allBranches && next === 'ALL' && !allBranchesSelected) {
              onChange({ kind: 'all' });
            } else if (
              next &&
              next !== branchId &&
              branches?.some((branch) => branch.id === next)
            )
              onChange({ kind: 'branch', branchId: next });
          }}
        >
          <option value="" disabled>
            {loading
              ? 'Loading branches…'
              : branches
                ? 'Choose a branch'
                : 'Branches unavailable'}
          </option>
          {allBranches ? <option value="ALL">All branches</option> : null}
          {(branches ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
              {branch.code ? ` (${branch.code})` : ''}
            </option>
          ))}
        </SelectControl>
      )}
    </div>
  );
}
