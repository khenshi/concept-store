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
import { listMerchants } from '@/features/merchants/merchant-api';
import type { Merchant } from '@/features/merchants/merchant.types';
import { listProducts } from '@/features/products/product-api';
import type { Product } from '@/features/products/product.types';
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
  upsertBranch(branch: Branch): void;
  merchants: Merchant[];
  merchantsStatus: LoadStatus;
  loadMerchants(options?: { refresh?: boolean }): Promise<Merchant[]>;
  products: Product[];
  productsStatus: LoadStatus;
  loadProducts(options?: { refresh?: boolean }): Promise<Product[]>;
  upsertProduct(product: Product): void;
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
  const branchesRef = useRef<Branch[]>([]);
  const branchesStatusRef = useRef<LoadStatus>('idle');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantsStatus, setMerchantsStatus] = useState<LoadStatus>('idle');
  const merchantsRef = useRef<Merchant[]>([]);
  const merchantsStatusRef = useRef<LoadStatus>('idle');
  const merchantsPromiseRef = useRef<Promise<Merchant[]> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsStatus, setProductsStatus] = useState<LoadStatus>('idle');
  const productsRef = useRef<Product[]>([]);
  const productsStatusRef = useRef<LoadStatus>('idle');
  const productsPromiseRef = useRef<Promise<Product[]> | null>(null);

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
        if (branchesStatusRef.current === 'ready') return branchesRef.current;
        if (branchesPromiseRef.current) return branchesPromiseRef.current;
      }

      branchesStatusRef.current = 'loading';
      setBranchesStatus('loading');
      setBranchesError(null);
      const promise = listBranches(request, organizationId)
        .then((result) => {
          branchesRef.current = result;
          setBranches(result);
          branchesStatusRef.current = 'ready';
          setBranchesStatus('ready');
          return result;
        })
        .catch((cause: unknown) => {
          setBranchesError(
            errorMessage(cause, 'The branches could not be loaded.'),
          );
          branchesStatusRef.current = 'error';
          setBranchesStatus('error');
          throw cause;
        })
        .finally(() => {
          branchesPromiseRef.current = null;
        });
      branchesPromiseRef.current = promise;
      return promise;
    },
    [organizationId, request],
  );

  const upsertBranch = useCallback((branch: Branch) => {
    const exists = branchesRef.current.some(
      (candidate) => candidate.id === branch.id,
    );
    const next = (
      exists
        ? branchesRef.current.map((candidate) =>
            candidate.id === branch.id ? branch : candidate,
          )
        : [...branchesRef.current, branch]
    ).sort((left, right) => left.name.localeCompare(right.name));
    branchesRef.current = next;
    branchesStatusRef.current = 'ready';
    setBranches(next);
    setBranchesStatus('ready');
    setBranchesError(null);
  }, []);

  const loadMerchants = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!options?.refresh) {
        if (merchantsStatusRef.current === 'ready') return merchantsRef.current;
        if (merchantsPromiseRef.current) return merchantsPromiseRef.current;
      }
      merchantsStatusRef.current = 'loading';
      setMerchantsStatus('loading');
      const promise = listMerchants(request, organizationId)
        .then((result) => {
          merchantsRef.current = result;
          merchantsStatusRef.current = 'ready';
          setMerchants(result);
          setMerchantsStatus('ready');
          return result;
        })
        .catch((cause: unknown) => {
          merchantsStatusRef.current = 'error';
          setMerchantsStatus('error');
          throw cause;
        })
        .finally(() => {
          merchantsPromiseRef.current = null;
        });
      merchantsPromiseRef.current = promise;
      return promise;
    },
    [organizationId, request],
  );

  const loadProducts = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!options?.refresh) {
        if (productsStatusRef.current === 'ready') return productsRef.current;
        if (productsPromiseRef.current) return productsPromiseRef.current;
      }
      productsStatusRef.current = 'loading';
      setProductsStatus('loading');
      const promise = listProducts(request, organizationId)
        .then((result) => {
          productsRef.current = result;
          productsStatusRef.current = 'ready';
          setProducts(result);
          setProductsStatus('ready');
          return result;
        })
        .catch((cause: unknown) => {
          productsStatusRef.current = 'error';
          setProductsStatus('error');
          throw cause;
        })
        .finally(() => {
          productsPromiseRef.current = null;
        });
      productsPromiseRef.current = promise;
      return promise;
    },
    [organizationId, request],
  );

  const upsertProduct = useCallback((product: Product) => {
    const next = [
      ...productsRef.current.filter((item) => item.id !== product.id),
      product,
    ].sort((left, right) => left.name.localeCompare(right.name));
    productsRef.current = next;
    productsStatusRef.current = 'ready';
    setProducts(next);
    setProductsStatus('ready');
  }, []);

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
      merchants,
      merchantsStatus,
      loadMerchants,
      products,
      productsStatus,
      loadProducts,
      upsertProduct,
      upsertBranch,
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
      upsertBranch,
      merchants,
      merchantsStatus,
      loadMerchants,
      products,
      productsStatus,
      loadProducts,
      upsertProduct,
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
