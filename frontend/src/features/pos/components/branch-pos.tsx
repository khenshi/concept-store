'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { TextField } from '@/shared/components/ui/text-field';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { getPosBranch, lookupPosCode, searchPosProducts } from '../api/pos-api';
import {
  addPosProduct,
  posCartTotal,
  posLineTotal,
  quantityError,
} from '../model/pos-cart';
import { posCodeSchema, posQuantitySchema } from '../model/pos.schemas';
import { POS_NAVIGATION_EVENT } from '../model/pos-navigation';
import type { PosCartLine, PosProduct, PosScope } from '../model/pos.types';
import {
  PaymentConfirmation,
  type CheckoutIssue,
} from './payment-confirmation';
import { SaleReceipt } from './sale-receipt';
import type { CompletedSale } from '../model/checkout';
import {
  checkoutAttemptKey,
  getCheckoutAttempt,
  setCheckoutAttempt,
  useCheckoutAttempt,
} from '../model/checkout-attempt';

export function BranchPos(props: PosScope) {
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
}: PosScope & { role: 'OWNER' | 'MANAGER' | 'CASHIER' }) {
  const { request, user } = useAuth();
  const attemptKey = checkoutAttemptKey(organizationId, user?.id ?? '');
  const attempt = useCheckoutAttempt(attemptKey);
  const recovering = Boolean(
    attempt &&
    attempt.scope.branchId === branchId &&
    attempt.state !== 'completed',
  );
  const [branch, setBranch] = useState<{
    id: string;
    name: string;
    code: string | null;
  } | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [revision, setRevision] = useState(0);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 300);
  const settled = search.trim() === q.trim();
  const [catalogLoading, setCatalogLoading] = useState(true);
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
      setBranch(null);
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
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, role, revision, denyAccess]);
  useEffect(() => {
    if (!branch || !settled || accessDenied || paying || recovering) return;
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
        if (active) setProducts(rows);
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
  ]);

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
        (url.origin === window.location.origin && url.pathname === pathname)
      )
        return true;
      if (
        !window.confirm(
          'Discard this branch’s cart and leave POS? Unsaved cart quantities will be lost.',
        )
      )
        return false;
      commitCart([]);
      return true;
    }
    function programmatic(event: Event) {
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
    if (paymentOpen.current || unsafeCheckout.current) return false;
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
        <BackLink href={`/app/organizations/${organizationId}/branches`}>
          Back to branches
        </BackLink>
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
  return (
    <OperationalPage>
      <BackLink
        href={`/app/organizations/${organizationId}/branches/${branchId}`}
      >
        Back to branch
      </BackLink>
      <PageHeader
        title={`${branch?.name ?? 'Branch'} POS`}
        description="Build a branch-specific cart, review payment and complete one sale. Prices and stock are estimates until server checkout."
      />
      <Link
        className={buttonStyles({ variant: 'secondary', className: 'mb-6' })}
        href={`/app/organizations/${organizationId}/branches/${branchId}/sales`}
      >
        View sales history
      </Link>
      {notice ? <StatusNotice>{notice}</StatusNotice> : null}
      {completed ? (
        <OperationalPanel
          title="Sale completed"
          description="This persisted sale is complete. Printing and catalog retries do not repeat checkout."
        >
          <div className="p-5 sm:p-6">
            <SaleReceipt sale={completed} />
            <Link
              className={buttonStyles({
                variant: 'secondary',
                className: 'mt-4',
              })}
              href={`/app/organizations/${organizationId}/branches/${branchId}/sales/${completed.id}`}
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
        disabled={paying || recovering}
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"
      >
        <div className="min-w-0">
          <OperationalPanel
            title="Add products"
            description="Enter an exact SKU or barcode. Repeating a code increases its cart quantity."
          >
            <form
              noValidate
              className="grid gap-4 p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void lookup();
              }}
            >
              <TextField
                ref={codeRef}
                label="SKU or barcode"
                value={code}
                autoComplete="off"
                spellCheck={false}
                disabled={lookupPending || Boolean(matches) || clearing}
                error={codeError}
                onChange={(event) => {
                  setCode(event.target.value);
                  validateCode(event.target.value);
                }}
                onBlur={() => validateCode(code, true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void lookup();
                  }
                }}
                hint="Barcode case and leading zeroes are preserved. Ambiguous codes require a choice."
              />
              <Button
                type="submit"
                className="w-fit max-sm:w-full"
                pending={lookupPending}
                pendingLabel="Looking up code…"
                disabled={Boolean(matches) || clearing}
              >
                Add code to cart
              </Button>
            </form>
          </OperationalPanel>
          <OperationalPanel
            title="Product search"
            description="Active products placed here only; at most 100 results. Narrow search for larger catalogs."
          >
            <div className="border-b border-hairline bg-subtle p-5 sm:p-6">
              <TextField
                label="Search products"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                hint="Search product name, SKU or barcode."
              />
            </div>
            {!settled || catalogLoading ? (
              <ListSkeleton
                className="p-6"
                label="Searching branch products"
                rows={3}
              />
            ) : catalogError ? (
              <RequestError
                className="p-6"
                message={catalogError}
                onRetry={() => setCatalogRevision((value) => value + 1)}
              />
            ) : !products.length ? (
              <p className="p-6 text-sm text-muted">
                {q.trim()
                  ? 'No matching active placed products. Try another search or code.'
                  : 'No active products are placed in this branch. Ask an owner to configure products and stock.'}
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {products.map((product) => (
                  <li
                    key={product.branchInventoryId}
                    className="grid min-w-0 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6"
                  >
                    <div className="min-w-0 break-words">
                      <h3 className="text-sm font-semibold">{product.name}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {product.merchantName} · SKU {product.sku ?? 'not set'}{' '}
                        · Barcode {product.barcode ?? 'not set'}
                      </p>
                      <p className="mt-2 text-sm tabular-nums">
                        PHP {product.sellingPrice} · {product.quantity} units
                        {!product.eligible ? ' · Out of stock' : ''}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      aria-label={`Add ${product.name}`}
                      disabled={
                        !product.eligible ||
                        lookupPending ||
                        Boolean(matches) ||
                        clearing
                      }
                      onClick={() => {
                        add(product);
                        focusCode();
                      }}
                    >
                      Add to cart
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </OperationalPanel>
        </div>
        <div className="min-w-0">
          <OperationalPanel
            title="Cart"
            description={`${cart.length} distinct products · this branch only`}
            action={
              cart.length ? (
                <Button
                  variant="quiet"
                  disabled={lookupPending || Boolean(matches)}
                  onClick={() => setClearing(true)}
                >
                  Clear cart
                </Button>
              ) : undefined
            }
          >
            {!cart.length ? (
              <p className="p-6 text-sm text-muted">
                Your cart is empty. Enter a code or choose a product.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {cart.map((line) => (
                  <li
                    key={line.product.branchInventoryId}
                    className="grid min-w-0 gap-4 p-5 sm:p-6"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="min-w-0 break-words">
                        <h3 className="text-sm font-semibold">
                          {line.product.name}
                        </h3>
                        <p className="mt-1 text-xs text-muted">
                          {line.product.merchantName} · PHP{' '}
                          {line.product.sellingPrice} each
                        </p>
                      </div>
                      <Button
                        variant="quiet"
                        aria-label={`Remove ${line.product.name}`}
                        disabled={lookupPending || Boolean(matches) || clearing}
                        onClick={() => {
                          window.clearTimeout(
                            quantityTimers.current.get(
                              line.product.branchInventoryId,
                            ),
                          );
                          commitCart(
                            cartRef.current.filter((row) => row !== line),
                          );
                          setNotice(null);
                          focusCode();
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                    <TextField
                      label={`Quantity for ${line.product.name}`}
                      inputMode="numeric"
                      value={line.quantityInput}
                      error={line.error}
                      disabled={lookupPending || Boolean(matches) || clearing}
                      hint={`Latest observed stock: ${line.product.quantity} whole units.`}
                      onChange={(event) =>
                        changeQuantity(
                          line.product.branchInventoryId,
                          event.target.value,
                        )
                      }
                      onBlur={() =>
                        validateQuantity(
                          line.product.branchInventoryId,
                          line.quantityInput,
                          true,
                        )
                      }
                    />
                    <p className="text-right text-sm font-semibold tabular-nums">
                      Line estimate: PHP {posLineTotal(line)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 border-t border-hairline bg-subtle p-5 sm:p-6">
              <p className="flex flex-wrap justify-between gap-3 font-semibold">
                <span>Estimated total</span>
                <output aria-label="Estimated total" className="tabular-nums">
                  PHP {posCartTotal(cart)}
                </output>
              </p>
              {invalidCart ? (
                <p role="alert" className="text-sm text-danger">
                  Fix invalid cart quantities. The estimate retains the last
                  valid quantity.
                </p>
              ) : null}
              <p className="text-xs leading-5 text-muted">
                Cart only: no stock has been deducted and no sale or payment has
                been recorded.
              </p>
              <Button
                disabled={
                  !cart.length ||
                  invalidCart ||
                  lookupPending ||
                  Boolean(matches) ||
                  clearing ||
                  paying
                }
                onClick={() => {
                  if (
                    lookupBusy.current ||
                    unsafeCheckout.current ||
                    !cartRef.current.length
                  )
                    return;
                  for (const timer of quantityTimers.current.values())
                    window.clearTimeout(timer);
                  paymentOpen.current = true;
                  setPaying(true);
                }}
              >
                Review payment
              </Button>
            </div>
          </OperationalPanel>
        </div>
      </fieldset>
      <PaymentConfirmation
        key={paymentRevision}
        open={paying || recovering}
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
          paymentOpen.current = false;
          setPaying(false);
          setPaymentRevision((value) => value + 1);
          setCatalogRevision((value) => value + 1);
          focusCode();
        }}
      />
      {matches ? (
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
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => {
              lookupBusy.current = false;
              setMatches(null);
              focusCode();
            }}
          >
            Cancel
          </Button>
        </FormDialog>
      ) : null}
      {clearing ? (
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
    </OperationalPage>
  );
}
