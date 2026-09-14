'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranches } from '@/features/branches/api/branch-api';
import type {
  Branch,
  BranchView,
} from '@/features/branches/model/branch.types';
import { getOrganization } from '../api/organization-api';
import type { OrganizationAccess } from '../model/organization.types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OrganizationWorkspaceContextValue {
  organizationId: string;
  organization: OrganizationAccess | null;
  organizationStatus: Exclude<LoadStatus, 'idle'>;
  organizationError: string | null;
  refreshOrganization(): Promise<void>;
  selectedBranchId: string | null;
  setSelectedBranchId(branchId: string): void;
  branches: BranchView[];
  branchesStatus: LoadStatus;
  branchesError: string | null;
  loadBranches(options?: { refresh?: boolean }): Promise<BranchView[]>;
  upsertBranch(branch: Branch): void;
}

const OrganizationWorkspaceContext =
  createContext<OrganizationWorkspaceContextValue | null>(null);

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

export function OrganizationWorkspaceProvider(props: {
  organizationId: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <ScopedOrganizationWorkspaceProvider
      key={`${props.organizationId}:${user?.id ?? ''}`}
      {...props}
    />
  );
}

function ScopedOrganizationWorkspaceProvider({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  const { request } = useAuth();
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [organizationStatus, setOrganizationStatus] =
    useState<Exclude<LoadStatus, 'idle'>>('loading');
  const [organizationError, setOrganizationError] = useState<string | null>(
    null,
  );
  const [branches, setBranches] = useState<BranchView[]>([]);
  const [branchesStatus, setBranchesStatus] = useState<LoadStatus>('idle');
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const branchesPromiseRef = useRef<Promise<BranchView[]> | null>(null);
  const branchesRef = useRef<BranchView[]>([]);
  const branchesStatusRef = useRef<LoadStatus>('idle');
  const branchGeneration = useRef(0);
  const organizationGeneration = useRef(0);
  const [selection, setSelection] = useState<{
    branchId: string;
    role: OrganizationAccess['role'];
  } | null>(null);
  const currentRole = useRef<OrganizationAccess['role'] | null>(null);
  const [accessGeneration, setAccessGeneration] = useState(0);
  const setSelectedBranchId = useCallback(
    (branchId: string) => {
      if (
        !organization ||
        organization.id !== organizationId ||
        !branchId ||
        accessGeneration !== organizationGeneration.current
      )
        return;
      setSelection((previous) =>
        previous?.branchId === branchId && previous.role === organization.role
          ? previous
          : { branchId, role: organization.role },
      );
    },
    [organization, organizationId, accessGeneration],
  );
  const selectedBranchId =
    organization?.role === selection?.role
      ? (selection?.branchId ?? null)
      : null;

  const clearBranches = useCallback(() => {
    branchGeneration.current += 1;
    branchesPromiseRef.current = null;
    branchesRef.current = [];
    branchesStatusRef.current = 'idle';
    setBranches([]);
    setBranchesStatus('idle');
    setBranchesError(null);
  }, []);

  const refreshOrganization = useCallback(async () => {
    const generation = ++organizationGeneration.current;
    setAccessGeneration(generation);
    clearBranches();
    setOrganization(null);
    setOrganizationStatus('loading');
    setOrganizationError(null);
    try {
      const result = await getOrganization(request, organizationId);
      if (generation !== organizationGeneration.current) return;
      if (currentRole.current !== result.role) setSelection(null);
      currentRole.current = result.role;
      setOrganization(result);
      setOrganizationStatus('ready');
    } catch (cause: unknown) {
      if (generation !== organizationGeneration.current) return;
      setOrganizationError(
        errorMessage(cause, 'The organization could not be loaded.'),
      );
      setOrganizationStatus('error');
    }
  }, [clearBranches, organizationId, request]);

  useEffect(() => {
    let active = true;
    const generation = ++organizationGeneration.current;
    setAccessGeneration(generation);
    void getOrganization(request, organizationId)
      .then((result) => {
        if (!active || generation !== organizationGeneration.current) return;
        if (currentRole.current !== result.role) setSelection(null);
        currentRole.current = result.role;
        setOrganization(result);
        setOrganizationStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active || generation !== organizationGeneration.current) return;
        setOrganizationError(
          errorMessage(cause, 'The organization could not be loaded.'),
        );
        setOrganizationStatus('error');
      });
    return () => {
      active = false;
      organizationGeneration.current += 1;
      branchGeneration.current += 1;
    };
  }, [organizationId, request]);

  const loadBranches = useCallback(
    async (options?: { refresh?: boolean }): Promise<BranchView[]> => {
      if (!options?.refresh) {
        if (branchesStatusRef.current === 'ready') return branchesRef.current;
        if (branchesPromiseRef.current) return branchesPromiseRef.current;
      }

      const generation = ++branchGeneration.current;
      branchesRef.current = [];
      setBranches([]);
      branchesStatusRef.current = 'loading';
      setBranchesStatus('loading');
      setBranchesError(null);
      const promise = listBranches(request, organizationId, organization?.role)
        .then((result) => {
          if (generation !== branchGeneration.current) return [];
          branchesRef.current = result;
          setBranches(result);
          branchesStatusRef.current = 'ready';
          setBranchesStatus('ready');
          return result;
        })
        .catch((cause: unknown) => {
          if (generation !== branchGeneration.current) throw cause;
          branchesRef.current = [];
          setBranches([]);
          setBranchesError(
            errorMessage(cause, 'The branches could not be loaded.'),
          );
          branchesStatusRef.current = 'error';
          setBranchesStatus('error');
          throw cause;
        })
        .finally(() => {
          if (generation === branchGeneration.current)
            branchesPromiseRef.current = null;
        });
      branchesPromiseRef.current = promise;
      return promise;
    },
    [organizationId, organization, request],
  );

  const upsertBranch = useCallback((branch: Branch) => {
    const next = [
      ...branchesRef.current.filter((item) => item.id !== branch.id),
      branch,
    ].sort((left, right) => left.name.localeCompare(right.name));
    branchesRef.current = next;
    branchesStatusRef.current = 'ready';
    setBranches(next);
    setBranchesStatus('ready');
    setBranchesError(null);
  }, []);

  const value = useMemo(
    () => ({
      organizationId,
      organization,
      organizationStatus,
      organizationError,
      refreshOrganization,
      selectedBranchId,
      setSelectedBranchId,
      branches,
      branchesStatus,
      branchesError,
      loadBranches,
      upsertBranch,
    }),
    [
      organizationId,
      organization,
      organizationStatus,
      organizationError,
      refreshOrganization,
      selectedBranchId,
      setSelectedBranchId,
      branches,
      branchesStatus,
      branchesError,
      loadBranches,
      upsertBranch,
    ],
  );

  return (
    <OrganizationWorkspaceContext.Provider value={value}>
      {children}
    </OrganizationWorkspaceContext.Provider>
  );
}

export function useOrganizationWorkspaceContext(): OrganizationWorkspaceContextValue {
  const context = useContext(OrganizationWorkspaceContext);
  if (!context) {
    throw new Error(
      'useOrganizationWorkspaceContext must be used inside OrganizationWorkspaceProvider',
    );
  }
  return context;
}
