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
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { listBranches } from '@/features/branches/branch-api';
import type { Branch } from '@/features/branches/branch.types';
import { getOrganization } from './organization-api';
import type { OrganizationAccess } from './organization.types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OrganizationWorkspaceContextValue {
  organizationId: string;
  organization: OrganizationAccess | null;
  organizationStatus: Exclude<LoadStatus, 'idle'>;
  organizationError: string | null;
  refreshOrganization(): Promise<void>;
  branches: Branch[];
  branchesStatus: LoadStatus;
  branchesError: string | null;
  loadBranches(options?: { refresh?: boolean }): Promise<Branch[]>;
}

const OrganizationWorkspaceContext =
  createContext<OrganizationWorkspaceContextValue | null>(null);

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

export function OrganizationWorkspaceProvider({
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesStatus, setBranchesStatus] = useState<LoadStatus>('idle');
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const branchesPromiseRef = useRef<Promise<Branch[]> | null>(null);

  const refreshOrganization = useCallback(async () => {
    setOrganizationStatus('loading');
    setOrganizationError(null);
    try {
      setOrganization(await getOrganization(request, organizationId));
      setOrganizationStatus('ready');
    } catch (cause: unknown) {
      setOrganizationError(
        errorMessage(cause, 'The organization could not be loaded.'),
      );
      setOrganizationStatus('error');
    }
  }, [organizationId, request]);

  useEffect(() => {
    let active = true;
    void getOrganization(request, organizationId)
      .then((result) => {
        if (!active) return;
        setOrganization(result);
        setOrganizationStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setOrganizationError(
          errorMessage(cause, 'The organization could not be loaded.'),
        );
        setOrganizationStatus('error');
      });
    return () => {
      active = false;
    };
  }, [organizationId, request]);

  const loadBranches = useCallback(
    async (options?: { refresh?: boolean }): Promise<Branch[]> => {
      if (!options?.refresh) {
        if (branchesStatus === 'ready') return branches;
        if (branchesPromiseRef.current) return branchesPromiseRef.current;
      }

      setBranchesStatus('loading');
      setBranchesError(null);
      const promise = listBranches(request, organizationId)
        .then((result) => {
          setBranches(result);
          setBranchesStatus('ready');
          return result;
        })
        .catch((cause: unknown) => {
          setBranchesError(
            errorMessage(cause, 'The branches could not be loaded.'),
          );
          setBranchesStatus('error');
          throw cause;
        })
        .finally(() => {
          branchesPromiseRef.current = null;
        });
      branchesPromiseRef.current = promise;
      return promise;
    },
    [branches, branchesStatus, organizationId, request],
  );

  const value = useMemo<OrganizationWorkspaceContextValue>(
    () => ({
      organizationId,
      organization,
      organizationStatus,
      organizationError,
      refreshOrganization,
      branches,
      branchesStatus,
      branchesError,
      loadBranches,
    }),
    [
      branches,
      branchesError,
      branchesStatus,
      loadBranches,
      organization,
      organizationError,
      organizationId,
      organizationStatus,
      refreshOrganization,
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
