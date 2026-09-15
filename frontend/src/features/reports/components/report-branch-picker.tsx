'use client';
import { useId } from 'react';
import { SelectControl } from '@/shared/components/ui/select-control';
import type { ReportBranch } from '../model/report.schemas';

export function ReportBranchPicker({
  branches,
  branchId = '',
  loading = branches === null,
  onChange,
  compact = false,
}: {
  branches: ReportBranch[] | null;
  branchId?: string;
  loading?: boolean;
  onChange(branchId: string): void;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={compact ? 'w-full min-w-56 max-w-sm' : 'my-6 max-w-xl'}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Reports branch
      </label>
      <SelectControl
        id={id}
        value={
          branches?.some((branch) => branch.id === branchId) ? branchId : ''
        }
        disabled={!branches?.length}
        onValueChange={(next) => {
          if (
            next &&
            next !== branchId &&
            branches?.some((branch) => branch.id === next)
          )
            onChange(next);
        }}
      >
        <option value="" disabled>
          {loading
            ? 'Loading branches…'
            : branches
              ? 'Choose a branch'
              : 'Branches unavailable'}
        </option>
        {(branches ?? []).map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
            {branch.code ? ` (${branch.code})` : ''}
          </option>
        ))}
      </SelectControl>
    </div>
  );
}
