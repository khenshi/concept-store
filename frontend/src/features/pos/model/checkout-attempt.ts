import { useSyncExternalStore } from 'react';
import type { CheckoutCommand, CompletedSale } from './checkout';
import type { PosCartLine, PosScope } from './pos.types';

// Memory only. An unresolved write is not an editable cart or an offline draft.
export type CheckoutAttempt = {
  scope: PosScope;
  lines: PosCartLine[];
  command: CheckoutCommand;
  state: 'pending' | 'unknown' | 'completed';
  sale?: CompletedSale;
};
const attempts = new Map<string, CheckoutAttempt>();
const listeners = new Set<() => void>();
export const checkoutAttemptKey = (organizationId: string, userId: string) =>
  `${organizationId}:${userId}`;
export const getCheckoutAttempt = (key: string) => attempts.get(key) ?? null;
export function setCheckoutAttempt(
  key: string,
  attempt: CheckoutAttempt | null,
) {
  if (attempt) attempts.set(key, attempt);
  else attempts.delete(key);
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useCheckoutAttempt(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => getCheckoutAttempt(key),
    () => null,
  );
}
