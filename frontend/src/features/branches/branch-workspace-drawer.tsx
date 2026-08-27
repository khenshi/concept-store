'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Branch } from './branch.types';

function addressFor(branch: Branch): string {
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.province,
    branch.postalCode,
    branch.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function BranchWorkspaceDrawer({
  organizationId,
  branch,
  canManage,
  onClose,
  onEdit,
}: {
  organizationId: string;
  branch: Branch;
  canManage: boolean;
  onClose(): void;
  onEdit(): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const basePath = `/app/organizations/${organizationId}`;

  useEffect(() => {
    closeRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        className="absolute inset-0 cursor-default border-0 bg-slate-950/35"
        type="button"
        aria-label="Close branch workspace"
        onClick={onClose}
      />
      <aside
        className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-workspace-title"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
              Branch workspace
            </p>
            <h2
              className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
              id="branch-workspace-title"
            >
              {branch.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {addressFor(branch)}
            </p>
          </div>
          <button
            ref={closeRef}
            className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-8 grid gap-3">
          <WorkspaceLink
            href={`${basePath}/spaces?branchId=${branch.id}`}
            title="Spaces and assignments"
            description="Manage this location’s retail spaces and merchant assignments."
          />
          <WorkspaceLink
            href={`${basePath}/inventory?branchId=${branch.id}`}
            title="Branch inventory"
            description="Review physical stock and record inventory movements at this location."
          />
          <WorkspaceLink
            href={`${basePath}/members`}
            title="Organization members"
            description="Review organization roles. Branch-specific access is not configured yet."
          />
        </div>
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Branch details
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Code: {branch.code ?? 'Not assigned'}
              </p>
            </div>
            {canManage ? (
              <button
                className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-emerald-700"
                type="button"
                onClick={onEdit}
              >
                Edit details
              </button>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

function WorkspaceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      className="group rounded-xl border border-slate-200 bg-white p-5 no-underline transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
      href={href}
    >
      <span className="flex items-center justify-between gap-4 font-bold text-slate-950">
        {title}
        <span
          className="text-emerald-600 transition group-hover:translate-x-1"
          aria-hidden="true"
        >
          →
        </span>
      </span>
      <span className="mt-2 block text-sm leading-6 text-slate-500">
        {description}
      </span>
    </Link>
  );
}
