import { useSyncExternalStore } from 'react';
import type { RefundScope } from '../api/refund-api';
import type { RefundCommand, StaffRefund } from './refund.schemas';
// Memory only, scoped to the original actor. No editable/persistent/offline drafts.
export type RefundAttempt = {
  scope: RefundScope;
  command: RefundCommand;
  state: 'pending' | 'unknown' | 'completed';
  refund?: StaffRefund;
};
const attempts = new Map<string, RefundAttempt>();
const listeners = new Set<() => void>();
export const refundAttemptKey = (organizationId: string, userId: string) =>
  `${organizationId}:${userId}`;
export const getRefundAttempt = (key: string) => attempts.get(key) ?? null;
export function setRefundAttempt(key: string, attempt: RefundAttempt | null) {
  if (attempt) attempts.set(key, attempt);
  else attempts.delete(key);
  for (const listener of listeners) listener();
}
export function useRefundAttempt(key: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => getRefundAttempt(key),
    () => null,
  );
}
