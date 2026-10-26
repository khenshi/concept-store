import type { PaymentAccount } from '@/features/payment-accounts/model/payment-account';

export const cashAccount: PaymentAccount = {
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Cash',
  enabled: true,
  systemKey: 'CASH',
  requiresReference: false,
  assignmentMode: 'ALL',
  version: 1,
  branchIds: [],
  available: true,
};
export const walletAccount: PaymentAccount = {
  ...cashAccount,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'GCash Main',
  systemKey: null,
  requiresReference: true,
};
export const bankAccount: PaymentAccount = {
  ...walletAccount,
  id: '99999999-9999-4999-8999-999999999999',
  name: 'BPI',
};
export const paymentAccounts = [cashAccount, walletAccount, bankAccount];
export const cashSnapshot = {
  paymentAccountId: cashAccount.id,
  paymentAccountName: cashAccount.name,
  paymentAccountIsCash: true,
  paymentAccountRequiresReference: false,
};
export const walletSnapshot = {
  paymentAccountId: walletAccount.id,
  paymentAccountName: walletAccount.name,
  paymentAccountIsCash: false,
  paymentAccountRequiresReference: true,
};
