import type { StaffSalesReport } from './report.schemas';
type Account = StaffSalesReport['paymentAccounts'][number];

export function reportAccount(
  name: string,
  fields: Partial<Account> = {},
): Account {
  const index = name === 'CASH' ? 1 : name === 'GCASH' ? 2 : 3;
  const received = fields.received ?? '0.00';
  const refunded = fields.refunded ?? '0.00';
  const net =
    BigInt(received.replace('.', '')) - BigInt(refunded.replace('.', ''));
  const magnitude = net < BigInt(0) ? -net : net;
  return {
    accountId: `${index}7777777-7777-4777-8777-777777777777`,
    displayName:
      name === 'CASH' ? 'Cash' : name === 'GCASH' ? 'GCash Main' : 'BPI',
    enabled: true,
    available: true,
    isCash: name === 'CASH',
    received,
    refunded,
    netReceived: `${net < BigInt(0) ? '-' : ''}${magnitude / BigInt(100)}.${(magnitude % BigInt(100)).toString().padStart(2, '0')}`,
    transactionCount: '0',
    refundCount: '0',
    ...fields,
  };
}
export function mergeAccountFlows(
  received: Account[],
  refunded: Account[],
): Account[] {
  return received
    .map((row) => {
      const refund = refunded.find(
        (account) => account.accountId === row.accountId,
      );
      return reportAccount(
        row.isCash
          ? 'CASH'
          : row.displayName === 'GCash Main'
            ? 'GCASH'
            : 'CARD',
        {
          ...row,
          ...(refund
            ? { refunded: refund.refunded, refundCount: refund.refundCount }
            : {}),
          netReceived: undefined,
        },
      );
    })
    .map((row) => ({
      ...row,
      netReceived: reportAccount(row.isCash ? 'CASH' : 'CARD', {
        received: row.received,
        refunded: row.refunded,
      }).netReceived,
    }));
}
