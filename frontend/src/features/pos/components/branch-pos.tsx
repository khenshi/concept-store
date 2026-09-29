'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { getPosBranch, lookupPosCode, searchPosProducts } from '../api/pos-api';
import { addPosProduct, quantityError } from '../model/pos-cart';
import { posCodeSchema, posQuantitySchema } from '../model/pos.schemas';
import { POS_NAVIGATION_EVENT } from '../model/pos-navigation';
import type { PosCartLine, PosProduct, PosScope } from '../model/pos.types';
import {
  PaymentConfirmation,
  type CheckoutIssue,
} from './payment-confirmation';
import { SaleReceipt } from './sale-receipt';
import { PosBranchSelector } from './pos-branch-selector';
import type { CompletedSale } from '../model/checkout';
import {
  checkoutAttemptKey,
  getCheckoutAttempt,
  setCheckoutAttempt,
  useCheckoutAttempt,
} from '../model/checkout-attempt';
import { useWorkspaceChrome } from '@/features/app-shell/components/workspace-chrome-context';
import { PosProductBrowser } from './pos-product-browser';
import { PosCartPanel } from './pos-cart-panel';
import { PosCartSummary } from './pos-cart-summary';
import { PosCartSheet } from './pos-cart-sheet';

type BranchPosProps = PosScope & {
  cartActive?: boolean;
  history?(active: boolean): ReactNode;
};
export function BranchPos(props: BranchPosProps) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  if (!organization || organization.id !== props.organizationId)
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Organization could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading POS access" />
        )}
      </OperationalPage>
    );
  if (organization.role === 'MERCHANT')
    return (
      <OperationalPage>
        <p role="alert">
          Your organization role cannot access POS. Use your own sales view
          instead.
        </p>
      </OperationalPage>
    );
  return (
    <ScopedBranchPos
      key={`${props.organizationId}:${props.branchId}:${organization.role}:${user?.id}`}
      {...props}
      role={organization.role}
    />
  );
}

function ScopedBranchPos({
  organizationId,
  branchId,
  role,
  cartActive: requestedCartActive = true,
  history,
}: BranchPosProps & { role: 'OWNER' | 'MANAGER' | 'CASHIER' }) {
  const { request, user } = useAuth();
  const { setSelectedBranchId } = useOrganizationWorkspaceContext();
  const { posFullscreen, enterPosFullscreen, exitPosFullscreen } =
    useWorkspaceChrome();
  const attemptKey = checkoutAttemptKey(organizationId, user?.id ?? '');
  const attempt = useCheckoutAttempt(attemptKey);
  const recovering = Boolean(
    attempt &&
    attempt.scope.branchId === branchId &&
    attempt.state !== 'completed',
  );
  // A browser-history/deep-link transition cannot conceal a frozen checkout.
  const cartActive = requestedCartActive || recovering;

  useEffect(() => {
    if (!posFullscreen) return;
    function exitOnEscape(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog[open]')
      ) {
        exitPosFullscreen();
        window.requestAnimationFrame(() => codeRef.current?.focus());
      }
    }
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [posFullscreen, exitPosFullscreen]);

  const [branchChecking, setBranchChecking] = useState(true);
  const [checkedCartActive, setCheckedCartActive] = useState<boolean | null>(
    null,
  );
  const branchReady = !branchChecking && checkedCartActive === cartActive;
  const [branch, setBranch] = useState<{
    id: string;
    name: string;
    code: string | null;
  } | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  useEffect(() => {
    if (
      posFullscreen &&
      (!requestedCartActive ||
        recovering ||
        Boolean(branchError) ||
        accessDenied)
    )
      exitPosFullscreen();
  }, [
    posFullscreen,
    requestedCartActive,
    recovering,
    branchReady,
    branchError,
    accessDenied,
    exitPosFullscreen,
  ]);
  const [revision, setRevision] = useState(0);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 300);
  const settled = search.trim() === q.trim();
  const [catalogLoading, setCatalogLoading] = useState(true);
  // After visiting History, require a fresh catalog read before reviewing payment.
  const [cartCatalogReady, setCartCatalogReady] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [lookupPending, setLookupPending] = useState(false);
  const lookupBusy = useRef(false);
  const lookupGeneration = useRef(0);
  const [matches, setMatches] = useState<PosProduct[] | null>(null);
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const cartRef = useRef<PosCartLine[]>([]);
  const [cartSheetState, setCartSheetState] = useState({
    routeActive: requestedCartActive,
    open: false,
  });
  if (cartSheetState.routeActive !== requestedCartActive)
    setCartSheetState({ routeActive: requestedCartActive, open: false });
  const cartSheetOpen =
    cartSheetState.routeActive === requestedCartActive && cartSheetState.open;
  const openCartSheet = () =>
    setCartSheetState({ routeActive: requestedCartActive, open: true });
  const closeCartSheet = () =>
    setCartSheetState({ routeActive: requestedCartActive, open: false });
  const [notice, setNotice] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [paying, setPaying] = useState(false);
  const unsafeCheckout = useRef(false);
  const paymentOpen = useRef(false);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const [paymentRevision, setPaymentRevision] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const codeTimer = useRef<number | undefined>(undefined);
  const quantityTimers = useRef(new Map<string, number>());
  const pathname = `/app/organizations/${organizationId}/branches/${branchId}/pos`;
  const commitCart = useCallback((next: PosCartLine[]) => {
    cartRef.current = next;
    setCart(next);
  }, []);
  const denyAccess = useCallback(() => {
    lookupGeneration.current++;
    lookupBusy.current = false;
    window.clearTimeout(codeTimer.current);
    for (const timer of quantityTimers.current.values())
      window.clearTimeout(timer);
    quantityTimers.current.clear();
    commitCart([]);
    setMatches(null);
    setClearing(false);
    setPaying(false);
    paymentOpen.current = false;
    setLookupPending(false);
    setCode('');
    setCodeError(undefined);
    setProducts([]);
    setBranch(null);
    setNotice(null);
    setAccessDenied(true);
    setBranchError(
      'POS access is unavailable. Ask an owner to check your branch assignment, then retry access.',
    );
  }, [commitCart]);

  useEffect(() => {
    const timers = quantityTimers.current;
    const invalidateLookup = () => {
      lookupGeneration.current++;
    };
    return () => {
      invalidateLookup();
      window.clearTimeout(codeTimer.current);
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setBranchChecking(true);
      setBranchError(null);
      setAccessDenied(false);
      try {
        const result = await getPosBranch(
          request,
          { organizationId, branchId },
          role,
        );
        if (active) {
          setBranch(result);
          setCheckedCartActive(cartActive);
          if (cartActive)
            window.requestAnimationFrame(() => codeRef.current?.focus());
        }
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && [403, 404].includes(cause.status))
          denyAccess();
        else
          setBranchError(
            cause instanceof ApiError
              ? cause.message
              : 'The branch could not be loaded.',
          );
      } finally {
        if (active) setBranchChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    branchId,
    role,
    revision,
    denyAccess,
    cartActive,
  ]);
  useEffect(() => {
    if (
      !cartActive ||
      !branchReady ||
      branchError ||
      !branch ||
      !settled ||
      accessDenied ||
      paying ||
      recovering
    )
      return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setCatalogLoading(true);
      setCatalogError(null);
      setProducts([]);
      try {
        const rows = await searchPosProducts(
          request,
          { organizationId, branchId },
          q,
        );
        if (active) {
          setProducts(rows);
          setCartCatalogReady(true);
        }
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && [403, 404].includes(cause.status))
          denyAccess();
        else
          setCatalogError(
            cause instanceof ApiError
              ? cause.message
              : 'Product search could not be loaded. Retry this read or use a code.',
          );
      } finally {
        if (active) setCatalogLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    branch,
    settled,
    accessDenied,
    paying,
    recovering,
    request,
    organizationId,
    branchId,
    q,
    catalogRevision,
    denyAccess,
    cartActive,
    branchReady,
    branchError,
  ]);

  useEffect(() => {
    if (cartActive) return;
    let active = true;
    lookupGeneration.current++;
    lookupBusy.current = false;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLookupPending(false);
      setMatches(null);
      setCartCatalogReady(false);
      setProducts([]);
      setCatalogLoading(true);
      setClearing(false);
      setPaying(false);
      paymentOpen.current = false;
    });
    return () => {
      active = false;
    };
  }, [cartActive]);

  useEffect(() => {
    function leaving(href: string) {
      const url = new URL(href, window.location.href);
      const unresolved = getCheckoutAttempt(attemptKey);
      if (
        unresolved &&
        unresolved.scope.branchId !== branchId &&
        url.origin === window.location.origin &&
        url.pathname ===
          `/app/organizations/${organizationId}/branches/${unresolved.scope.branchId}/pos`
      )
        return true;
      if (
        (unsafeCheckout.current ||
          getCheckoutAttempt(attemptKey)?.state === 'pending' ||
          getCheckoutAttempt(attemptKey)?.state === 'unknown') &&
        (url.origin !== window.location.origin || url.pathname !== pathname)
      ) {
        window.alert(
          'Checkout is pending or its outcome is unknown. Resolve the same checkout before leaving POS.',
        );
        return false;
      }
      if (
        cartRef.current.length === 0 ||
        (url.origin === window.location.origin &&
          (url.pathname === pathname ||
            url.pathname === `${pathname}/sales` ||
            url.pathname.startsWith(`${pathname}/sales/`)))
      )
        return true;
      if (
        !window.confirm(
          'Discard this branch’s cart and leave POS? Unsaved cart quantities will be lost.',
        )
      )
        return false;
      commitCart([]);
      lookupGeneration.current += 1;
      lookupBusy.current = false;
      setPaymentRevision((value) => value + 1);
      return true;
    }
    function programmatic(event: Event) {
      if (event.defaultPrevented) return;
      const href = (event as CustomEvent<{ href: string }>).detail?.href;
      if (typeof href === 'string' && !leaving(href)) event.preventDefault();
    }
    function linkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      if (
        !anchor ||
        anchor.download ||
        (anchor.target && anchor.target !== '_self')
      )
        return;
      if (!leaving(anchor.href)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (
        cartRef.current.length ||
        unsafeCheckout.current ||
        getCheckoutAttempt(attemptKey)?.state === 'pending' ||
        getCheckoutAttempt(attemptKey)?.state === 'unknown'
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener(POS_NAVIGATION_EVENT, programmatic);
    document.addEventListener('click', linkClick, true);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener(POS_NAVIGATION_EVENT, programmatic);
      document.removeEventListener('click', linkClick, true);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [pathname, commitCart, attemptKey, branchId, organizationId]);

  function validateCode(value: string, immediate = false) {
    window.clearTimeout(codeTimer.current);
    const run = () => {
      if (!value.trim()) {
        setCodeError(undefined);
        return;
      }
      const result = posCodeSchema.safeParse(value);
      setCodeError(
        result.success ? undefined : result.error.issues[0]?.message,
      );
    };
    if (immediate) run();
    else codeTimer.current = window.setTimeout(run, 300);
  }
  function focusCode() {
    window.requestAnimationFrame(() => codeRef.current?.focus());
  }
  function add(product: PosProduct): boolean {
    if (
      !cartActive ||
      !branchReady ||
      branchError ||
      paymentOpen.current ||
      unsafeCheckout.current
    )
      return false;
    try {
      commitCart(addPosProduct(cartRef.current, product));
      setNotice(`${product.name} added to this branch’s cart.`);
      setCodeError(undefined);
      return true;
    } catch (cause) {
      setCodeError(
        cause instanceof Error ? cause.message : 'Product could not be added.',
      );
      setNotice(null);
      return false;
    }
  }
  async function lookup() {
    if (
      lookupBusy.current ||
      matches ||
      clearing ||
      paymentOpen.current ||
      unsafeCheckout.current ||
      !branch ||
      !cartActive ||
      !branchReady ||
      branchError ||
      accessDenied
    )
      return;
    window.clearTimeout(codeTimer.current);
    const parsed = posCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message);
      focusCode();
      return;
    }
    lookupBusy.current = true;
    setLookupPending(true);
    setCodeError(undefined);
    setNotice(null);
    const generation = ++lookupGeneration.current;
    let ambiguous = false;
    try {
      const rows = await lookupPosCode(
        request,
        { organizationId, branchId },
        parsed.data,
      );
      if (generation !== lookupGeneration.current) return;
      if (!rows.length)
        setCodeError(
          'No active placed product matches this code in this branch.',
        );
      else if (rows.length > 1) {
        ambiguous = true;
        setMatches(rows);
        return;
      } else if (add(rows[0])) setCode('');
    } catch (cause) {
      if (generation !== lookupGeneration.current) return;
      if (cause instanceof ApiError && [403, 404].includes(cause.status))
        denyAccess();
      else
        setCodeError(
          cause instanceof ApiError
            ? cause.message
            : 'Code lookup failed. No product was added; try again.',
        );
    } finally {
      if (generation === lookupGeneration.current) {
        // Keep the synchronous guard until an ambiguous choice is dismissed.
        if (!ambiguous) lookupBusy.current = false;
        setLookupPending(false);
        focusCode();
      }
    }
  }
  function changeQuantity(id: string, value: string) {
    if (paymentOpen.current || unsafeCheckout.current) return;
    const parsed = posQuantitySchema.safeParse(value);
    commitCart(
      cartRef.current.map((line) =>
        line.product.branchInventoryId === id
          ? {
              ...line,
              quantityInput: value,
              quantity:
                parsed.success && parsed.data <= line.product.quantity
                  ? parsed.data
                  : line.quantity,
            }
          : line,
      ),
    );
    validateQuantity(id, value);
  }
  function validateQuantity(id: string, value: string, immediate = false) {
    window.clearTimeout(quantityTimers.current.get(id));
    const run = () =>
      commitCart(
        cartRef.current.map((line) =>
          line.product.branchInventoryId === id && line.quantityInput === value
            ? { ...line, error: quantityError(value, line.product.quantity) }
            : line,
        ),
      );
    if (immediate) run();
    else quantityTimers.current.set(id, window.setTimeout(run, 300));
  }
  const invalidCart = cart.some((line) =>
    quantityError(line.quantityInput, line.product.quantity),
  );
  const cartLocked =
    lookupPending ||
    Boolean(matches) ||
    clearing ||
    paying ||
    recovering ||
    !branchReady ||
    Boolean(branchError);
  const reviewDisabled =
    !cart.length || invalidCart || cartLocked || !cartCatalogReady;

  function adjustQuantity(line: PosCartLine, delta: -1 | 1) {
    if (
      paymentOpen.current ||
      unsafeCheckout.current ||
      quantityError(line.quantityInput, line.product.quantity)
    )
      return;
    const next = line.quantity + delta;
    if (next < 1 || next > line.product.quantity) return;
    const id = line.product.branchInventoryId;
    const value = String(next);
    changeQuantity(id, value);
    validateQuantity(id, value, true);
  }

  function removeCartLine(line: PosCartLine) {
    if (paymentOpen.current || unsafeCheckout.current || cartLocked) return;
    const id = line.product.branchInventoryId;
    window.clearTimeout(quantityTimers.current.get(id));
    quantityTimers.current.delete(id);
    commitCart(
      cartRef.current.filter((row) => row.product.branchInventoryId !== id),
    );
    setNotice(null);
    focusCode();
  }

  function reviewPayment() {
    if (lookupBusy.current || unsafeCheckout.current || reviewDisabled) return;
    for (const timer of quantityTimers.current.values())
      window.clearTimeout(timer);
    paymentOpen.current = true;
    setPaying(true);
  }

  useEffect(() => {
    if (
      attempt?.state !== 'completed' ||
      attempt.scope.branchId !== branchId ||
      !attempt.sale
    )
      return;
    const sale = attempt.sale;
    void Promise.resolve().then(() => {
      setCompleted(sale);
      setPaying(false);
      paymentOpen.current = false;
      unsafeCheckout.current = false;
      setPaymentRevision((value) => value + 1);
      setCheckoutAttempt(attemptKey, null);
    });
  }, [attempt, attemptKey, branchId]);
  function checkoutIssue(issue: CheckoutIssue) {
    if (issue.code === 'ACCESS_DENIED') {
      denyAccess();
      return;
    }
    const id = issue.branchInventoryId;
    const price = issue.sellingPrice;
    if (
      issue.code === 'PRICE_CHANGED' &&
      id &&
      price &&
      /^(?=.*[1-9])\d{1,10}\.\d{2}$/.test(price)
    ) {
      commitCart(
        cartRef.current.map((line) =>
          line.product.branchInventoryId === id
            ? { ...line, product: { ...line.product, sellingPrice: price } }
            : line,
        ),
      );
      setNotice(
        `${issue.message}. The estimate was updated; review the new total and confirm payment again. No sale was recorded.`,
      );
    } else if (
      issue.code === 'INSUFFICIENT_STOCK' &&
      id &&
      Number.isInteger(issue.quantity) &&
      issue.quantity! >= 0 &&
      issue.quantity! <= 2147483647
    ) {
      commitCart(
        cartRef.current.map((line) =>
          line.product.branchInventoryId === id
            ? {
                ...line,
                product: {
                  ...line.product,
                  quantity: issue.quantity!,
                  eligible: issue.quantity! > 0,
                },
                error: quantityError(line.quantityInput, issue.quantity!),
              }
            : line,
        ),
      );
      setNotice(
        `${issue.message}. Review quantities or remove the unavailable line. No sale was recorded.`,
      );
    } else if (issue.code === 'PRODUCT_UNAVAILABLE' && id) {
      commitCart(
        cartRef.current.map((line) =>
          line.product.branchInventoryId === id
            ? {
                ...line,
                product: { ...line.product, quantity: 0, eligible: false },
                error:
                  'This product or merchant is no longer active. Remove this line.',
              }
            : line,
        ),
      );
      setNotice(`${issue.message}. No sale was recorded.`);
    } else setNotice(issue.message);
    setCatalogRevision((value) => value + 1);
  }
  if (
    attempt &&
    attempt.scope.branchId !== branchId &&
    attempt.state !== 'completed'
  )
    return (
      <OperationalPage>
        <p role="alert">
          An earlier checkout in another branch is pending or unconfirmed.
          Resolve that checkout before creating another sale.
        </p>
        <BackLink
          href={`/app/organizations/${organizationId}/branches/${attempt.scope.branchId}/pos`}
        >
          Return to unresolved checkout
        </BackLink>
      </OperationalPage>
    );
  if (!branch && !recovering)
    return (
      <OperationalPage>
        {branchError ? (
          <RequestError
            className="mt-6"
            message={branchError}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : (
          <ListSkeleton
            className="mt-6"
            label="Loading authorized POS branch"
          />
        )}
      </OperationalPage>
    );
  const branchSelector = (
    <PosBranchSelector
      key={String(cartActive)}
      organizationId={organizationId}
      branchId={branchId}
      role={role}
      disabled={paying || recovering || !branchReady || Boolean(branchError)}
      onAccessDenied={denyAccess}
      rememberBranch={setSelectedBranchId}
      compact
    />
  );
  const tabs = [
    { label: 'Cart', href: pathname, active: cartActive },
    {
      label: 'Sales History',
      href: `${pathname}/sales`,
      active: !cartActive,
    },
  ];
  return (
    <section
      className={
        posFullscreen
          ? 'flex h-full min-w-0 min-h-0 w-full max-w-none flex-col overflow-hidden bg-surface'
          : 'mx-auto mt-5 w-full max-w-7xl sm:mt-6'
      }
    >
      {posFullscreen ? (
        <header className="flex min-h-[3.75rem] flex-[0_0_auto] items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-1.5 max-lg:items-start max-lg:flex-wrap max-lg:py-2">
          <h1 className="min-w-0 text-base font-semibold">POS · Cart</h1>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {branchSelector}
            <Link
              href={`${pathname}/sales`}
              aria-disabled={recovering ? true : undefined}
              className={buttonStyles({ variant: 'secondary' })}
            >
              Sales history
            </Link>
            <Button
              variant="quiet"
              onClick={() => {
                exitPosFullscreen();
                focusCode();
              }}
            >
              Exit full screen
            </Button>
          </div>
        </header>
      ) : (
        <>
          <PageHeader
            title="POS"
            description="Scan or search products, then review the cart."
            className="!pb-5"
            action={
              <div className="flex flex-wrap items-center gap-2">
                {branchSelector}
                {requestedCartActive && !recovering ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      enterPosFullscreen();
                      focusCode();
                    }}
                  >
                    Full screen POS
                  </Button>
                ) : null}
              </div>
            }
          />
          <nav
            aria-label="POS pages"
            className="mb-4 flex flex-wrap gap-6 border-b border-hairline"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                aria-disabled={!tab.active && recovering ? true : undefined}
                className="flex min-h-11 items-center border-b-2 border-transparent py-2 text-sm font-medium text-muted no-underline hover:text-accent aria-[current=page]:border-accent aria-[current=page]:text-accent"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </>
      )}
      {branchError ? (
        <RequestError
          message={branchError}
          onRetry={() => setRevision((value) => value + 1)}
        />
      ) : null}
      <div hidden={cartActive || !branchReady || Boolean(branchError)}>
        {history?.(!cartActive && branchReady && !branchError)}
      </div>
      <div
        hidden={!cartActive}
        className={
          posFullscreen
            ? 'flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden'
            : 'pb-32 lg:pb-0'
        }
      >
        {completed && cartActive ? (
          <OperationalPanel
            variant="open"
            title="Sale completed"
            description="This persisted sale is complete. Printing and catalog retries do not repeat checkout."
          >
            <div className="py-5 sm:py-6">
              <SaleReceipt sale={completed} />
              <Link
                className={buttonStyles({
                  variant: 'secondary',
                  className: 'mt-4',
                })}
                href={`${pathname}/sales/${completed.id}`}
              >
                Open saved receipt
              </Link>
              <Button
                variant="quiet"
                className="mt-4"
                onClick={() => {
                  setCompleted(null);
                  focusCode();
                }}
              >
                Dismiss receipt
              </Button>
            </div>
          </OperationalPanel>
        ) : null}
        <fieldset
          disabled={
            paying || recovering || !branchReady || Boolean(branchError)
          }
          aria-label="POS checkout workspace"
          className={`grid min-w-0 gap-4 border-0 p-0 lg:landscape:h-[calc(100dvh-18rem)] lg:landscape:min-h-[20rem] lg:landscape:grid-cols-[minmax(0,1.62fr)_minmax(19rem,1fr)] ${posFullscreen ? 'lg:landscape:h-auto lg:landscape:max-h-none lg:landscape:min-h-0 lg:landscape:flex-1 max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:overflow-hidden' : ''}`}
        >
          <PosProductBrowser
            fullscreen={posFullscreen}
            code={code}
            codeError={codeError}
            codeRef={codeRef}
            lookupPending={lookupPending}
            hasMatches={Boolean(matches)}
            clearing={clearing}
            onCodeChange={(value) => {
              setCode(value);
              validateCode(value);
            }}
            onCodeBlur={() => validateCode(code, true)}
            onLookup={() => void lookup()}
            search={search}
            onSearchChange={setSearch}
            settled={settled}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            onCatalogRetry={() => setCatalogRevision((value) => value + 1)}
            products={products}
            onAdd={(product) => {
              add(product);
              focusCode();
            }}
            notice={notice}
          />
          <div className="hidden min-w-0 lg:landscape:block lg:landscape:h-full lg:landscape:min-h-0">
            <PosCartPanel
              fullscreen={posFullscreen}
              lines={cart}
              locked={cartLocked}
              invalid={invalidCart}
              reviewDisabled={reviewDisabled}
              onClear={() => setClearing(true)}
              onRemove={removeCartLine}
              onQuantityChange={(line, value) =>
                changeQuantity(line.product.branchInventoryId, value)
              }
              onQuantityBlur={(line) =>
                validateQuantity(
                  line.product.branchInventoryId,
                  line.quantityInput,
                  true,
                )
              }
              onAdjustQuantity={adjustQuantity}
              onReviewPayment={reviewPayment}
            />
          </div>
        </fieldset>
        <PosCartSummary
          lines={cart}
          reviewDisabled={reviewDisabled}
          onOpenCart={openCartSheet}
          onReviewPayment={reviewPayment}
        />
        <PosCartSheet
          open={cartSheetOpen && cartActive}
          lockBackground={!posFullscreen}
          onClose={closeCartSheet}
        >
          {cartSheetOpen && cartActive ? (
            <PosCartPanel
              lines={cart}
              locked={cartLocked}
              invalid={invalidCart}
              reviewDisabled={reviewDisabled}
              onClear={() => setClearing(true)}
              onRemove={removeCartLine}
              onQuantityChange={(line, value) =>
                changeQuantity(line.product.branchInventoryId, value)
              }
              onQuantityBlur={(line) =>
                validateQuantity(
                  line.product.branchInventoryId,
                  line.quantityInput,
                  true,
                )
              }
              onAdjustQuantity={adjustQuantity}
              onReviewPayment={() => {
                closeCartSheet();
                reviewPayment();
              }}
              onClose={closeCartSheet}
              estimatedTotalLabel="Cart sheet estimated total"
              reviewButtonLabel="Review payment from cart sheet"
            />
          ) : null}
        </PosCartSheet>
        <PaymentConfirmation
          key={paymentRevision}
          open={cartActive && (paying || recovering)}
          attemptKey={attemptKey}
          request={request}
          scope={{ organizationId, branchId }}
          lines={recovering ? attempt!.lines : cart}
          onUnsafeChange={(value) => {
            unsafeCheckout.current = value;
          }}
          onClose={() => {
            paymentOpen.current = false;
            setPaying(false);
            focusCode();
          }}
          onIssue={checkoutIssue}
          onCompleted={(sale) => {
            commitCart([]);
            setCompleted(sale);
            setCode('');
            setNotice(null);
            closeCartSheet();
            paymentOpen.current = false;
            setPaying(false);
            setPaymentRevision((value) => value + 1);
            setCatalogRevision((value) => value + 1);
            focusCode();
          }}
        />
        {matches && cartActive ? (
          <FormDialog
            title="Choose the matching product"
            description="This code matches more than one product’s SKU or barcode. Select explicitly; nothing has been added yet."
            onClose={() => {
              lookupBusy.current = false;
              setMatches(null);
              focusCode();
            }}
          >
            <ul className="mt-6 divide-y divide-hairline">
              {matches.map((product) => (
                <li
                  key={product.branchInventoryId}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0 break-words">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {product.merchantName} · SKU {product.sku ?? 'not set'} ·
                      Barcode {product.barcode ?? 'not set'}
                    </p>
                    <p className="mt-1 tabular-nums">
                      PHP {product.sellingPrice} · {product.quantity} units
                      {!product.eligible ? ' · Out of stock' : ''}
                    </p>
                  </div>
                  <Button
                    disabled={!product.eligible}
                    aria-label={`Choose ${product.name}`}
                    onClick={() => {
                      if (add(product)) setCode('');
                      lookupBusy.current = false;
                      setMatches(null);
                      focusCode();
                    }}
                  >
                    Choose product
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  lookupBusy.current = false;
                  setMatches(null);
                  focusCode();
                }}
              >
                Cancel
              </Button>
            </div>
          </FormDialog>
        ) : null}
        {clearing && cartActive ? (
          <FormDialog
            title="Discard this cart?"
            description="Remove all products and quantities from this branch’s unsaved cart. No stock or recorded sale will change."
            onClose={() => setClearing(false)}
          >
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setClearing(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  commitCart([]);
                  setNotice(null);
                  setClearing(false);
                  focusCode();
                }}
              >
                Discard cart
              </Button>
            </div>
          </FormDialog>
        ) : null}
      </div>
    </section>
  );
}
