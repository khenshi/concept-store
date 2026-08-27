'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Space } from '../space.types';
import { listBranchSpaceAssignments } from './space-assignment-api';
import { SpaceAssignmentManagement } from './space-assignment-management';
import type { SpaceAssignment } from './space-assignment.types';

type AssignmentView = 'all' | 'current' | 'history' | 'unassigned';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The assignment workspace could not be loaded. Please try again.';
}

function businessDate(value: string): string {
  const date = value.slice(0, 10);
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

export function SpaceAssignmentWorkspace({
  organizationId,
  branchId,
  spaces,
  onAssignmentsChanged,
}: {
  organizationId: string;
  branchId: string;
  spaces: Space[];
  onAssignmentsChanged(): void | Promise<void>;
}) {
  const { request } = useAuth();
  const [assignments, setAssignments] = useState<SpaceAssignment[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AssignmentView>('all');
  const [merchantId, setMerchantId] = useState('');
  const [spaceId, setSpaceId] = useState('');

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAssignments(
        await listBranchSpaceAssignments(request, organizationId, branchId),
      );
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [branchId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void listBranchSpaceAssignments(request, organizationId, branchId)
      .then((result) => {
        if (active) setAssignments(result);
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
  }, [branchId, organizationId, request]);

  const merchants = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    assignments.forEach(({ merchant }) => byId.set(merchant.id, merchant));
    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [assignments]);

  const currentSpaceIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.endDate === null)
          .map((assignment) => assignment.spaceId),
      ),
    [assignments],
  );

  const visibleAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const space = assignment.space;
      return (
        view !== 'unassigned' &&
        (view === 'all' ||
          (view === 'current' && assignment.endDate === null) ||
          (view === 'history' && assignment.endDate !== null)) &&
        (!merchantId || assignment.merchantId === merchantId) &&
        (!spaceId || assignment.spaceId === spaceId) &&
        (!query ||
          `${space?.name ?? ''} ${space?.code ?? ''} ${assignment.merchant.name} ${assignment.merchant.code ?? ''}`
            .toLowerCase()
            .includes(query))
      );
    });
  }, [assignments, merchantId, search, spaceId, view]);

  const unassignedSpaces = useMemo(() => {
    if (view !== 'all' && view !== 'unassigned') return [];
    const query = search.trim().toLowerCase();
    return spaces.filter(
      (space) =>
        !currentSpaceIds.has(space.id) &&
        (!spaceId || space.id === spaceId) &&
        !merchantId &&
        (!query || `${space.name} ${space.code}`.toLowerCase().includes(query)),
    );
  }, [currentSpaceIds, merchantId, search, spaceId, spaces, view]);

  async function handleChanged() {
    await Promise.all([loadAssignments(), onAssignmentsChanged()]);
  }

  const resultCount = visibleAssignments.length + unassignedSpaces.length;

  return (
    <>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-base font-bold">Space assignments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review current occupancy and preserved assignment history for this
            branch. Open a space to assign a merchant or end its current term.
          </p>
        </div>

        <div className="mt-5 grid items-end gap-4 border-y border-slate-200 bg-slate-50/60 py-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-2">
            <label className="text-sm font-bold" htmlFor="assignment-search">
              Search
            </label>
            <input
              className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-3"
              id="assignment-search"
              type="search"
              value={search}
              placeholder="Space or merchant"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-bold" htmlFor="assignment-state">
              Assignment state
            </label>
            <SelectControl
              id="assignment-state"
              value={view}
              onValueChange={(value) => setView(value as AssignmentView)}
            >
              <option value="all">All records</option>
              <option value="current">Current assignments</option>
              <option value="history">Assignment history</option>
              <option value="unassigned">Unassigned spaces</option>
            </SelectControl>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-bold" htmlFor="assignment-space">
              Space
            </label>
            <SelectControl
              id="assignment-space"
              value={spaceId}
              onValueChange={setSpaceId}
            >
              <option value="">All spaces</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </SelectControl>
          </div>
          <div className="grid gap-2">
            <label
              className="text-sm font-bold"
              htmlFor="assignment-merchant-filter"
            >
              Merchant
            </label>
            <SelectControl
              id="assignment-merchant-filter"
              value={merchantId}
              onValueChange={setMerchantId}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </SelectControl>
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton
            label="Loading branch assignments"
            rowClassName="h-16"
          />
        ) : loadError ? (
          <RequestError
            className="py-8 text-center"
            title="Assignments are unavailable"
            message={loadError}
            onRetry={() => void loadAssignments()}
          />
        ) : resultCount === 0 ? (
          <div className="py-10 text-center">
            <h3 className="text-base font-bold">No matching assignments</h3>
            <p className="mt-2 text-slate-500">
              Adjust the filters or select another branch.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-3 font-bold">Space</th>
                  <th className="px-3 py-3 font-bold">Merchant</th>
                  <th className="px-3 py-3 font-bold">Period</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-3 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleAssignments.map((assignment) => {
                  const space = spaces.find(
                    (candidate) => candidate.id === assignment.spaceId,
                  );
                  return (
                    <tr key={assignment.id}>
                      <td className="px-3 py-4">
                        <strong className="block">
                          {assignment.space?.name ?? space?.name ?? 'Space'}
                        </strong>
                        <span className="text-slate-500">
                          {assignment.space?.code ?? space?.code}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <strong>{assignment.merchant.name}</strong>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {businessDate(assignment.startDate)} –{' '}
                        {assignment.endDate
                          ? businessDate(assignment.endDate)
                          : 'Present'}
                      </td>
                      <td className="px-3 py-4">
                        <AssignmentBadge
                          current={assignment.endDate === null}
                        />
                      </td>
                      <td className="px-3 py-4 text-right">
                        {space ? (
                          <button
                            className="border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
                            type="button"
                            onClick={() => setSelectedSpace(space)}
                          >
                            Manage
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {unassignedSpaces.map((space) => (
                  <tr key={`unassigned-${space.id}`}>
                    <td className="px-3 py-4">
                      <strong className="block">{space.name}</strong>
                      <span className="text-slate-500">{space.code}</span>
                    </td>
                    <td className="px-3 py-4 text-slate-400">—</td>
                    <td className="px-3 py-4 text-slate-400">—</td>
                    <td className="px-3 py-4">
                      <AssignmentBadge current={false} unassigned />
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button
                        className="border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
                        type="button"
                        onClick={() => setSelectedSpace(space)}
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSpace ? (
        <SpaceAssignmentManagement
          key={selectedSpace.id}
          organizationId={organizationId}
          space={selectedSpace}
          onClose={() => setSelectedSpace(null)}
          onChanged={handleChanged}
        />
      ) : null}
    </>
  );
}

function AssignmentBadge({
  current,
  unassigned = false,
}: {
  current: boolean;
  unassigned?: boolean;
}) {
  const label = unassigned ? 'Unassigned' : current ? 'Current' : 'Ended';
  const styles = current
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>
      {label}
    </span>
  );
}
