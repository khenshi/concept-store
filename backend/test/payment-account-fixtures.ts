import { PrismaClient } from '../src/generated/prisma/client';

const accounts = new Map<string, Record<string, string>>();
export async function provisionPaymentFixtures(
  db: PrismaClient,
  organizationId: string,
) {
  const cash = await db.paymentAccount.findUniqueOrThrow({
    where: { organizationId_systemKey: { organizationId, systemKey: 'CASH' } },
  });
  const ids: Record<string, string> = { CASH: cash.id };
  for (const label of ['GCASH', 'CARD']) {
    const account = await db.paymentAccount.upsert({
      where: {
        organizationId_normalizedName: {
          organizationId,
          normalizedName: label.toLowerCase(),
        },
      },
      create: {
        organizationId,
        name: label,
        normalizedName: label.toLowerCase(),
        assignmentMode: 'ALL',
        requiresReference: true,
      },
      update: {},
    });
    ids[label] = account.id;
  }
  accounts.set(organizationId, ids);
}
export function testAccountId(organizationId: string, label = 'CASH') {
  return (
    accounts.get(organizationId)?.[label] ??
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  );
}
export function testAccountSnapshot(organizationId: string, label = 'CASH') {
  return {
    paymentAccountId: testAccountId(organizationId, label),
    paymentAccountName: label === 'CASH' ? 'Cash' : label,
    paymentAccountIsCash: label === 'CASH',
    paymentAccountRequiresReference: label !== 'CASH',
  };
}
