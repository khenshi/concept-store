import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

export function paymentWriteConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const adapter = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  const code =
    typeof error.meta?.code === 'string'
      ? error.meta.code
      : adapter?.cause?.originalCode;
  return (
    ['P2002', 'P2034'].includes(error.code) ||
    (error.code === 'P2010' && ['40001', '40P01'].includes(code ?? ''))
  );
}

export async function lockAvailablePaymentAccount(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
  id: string,
) {
  const locked = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "PaymentAccount" WHERE "organizationId" = ${organizationId} AND "id" = ${id} FOR UPDATE`,
  );
  if (!locked.length) throw new NotFoundException('Payment account not found');
  const account = await tx.paymentAccount.findFirst({
    where: { id, organizationId },
    include: {
      branches: {
        where: { organizationId, branchId },
        select: { branchId: true },
      },
    },
  });
  if (!account) throw new NotFoundException('Payment account not found');
  if (
    !account.enabled ||
    (account.assignmentMode === 'SELECTED' && !account.branches.length)
  )
    throw new ConflictException({
      message: 'Payment account is no longer available in this branch',
      code: 'PAYMENT_ACCOUNT_UNAVAILABLE',
    });
  return account;
}

export function paymentSnapshot(
  account: {
    id: string;
    name: string;
    systemKey: string | null;
    requiresReference: boolean;
  },
  fields: { cashTender?: string; paymentReference?: string },
  refund = false,
) {
  const cash = account.systemKey === 'CASH';
  if (
    (refund && fields.cashTender !== undefined) ||
    (cash
      ? fields.paymentReference !== undefined ||
        (!refund && fields.cashTender === undefined)
      : fields.cashTender !== undefined ||
        (account.requiresReference && fields.paymentReference === undefined))
  )
    throw new BadRequestException(
      'Payment fields do not match the selected account',
    );
  if (
    fields.paymentReference !== undefined &&
    (typeof fields.paymentReference !== 'string' ||
      fields.paymentReference.trim() !== fields.paymentReference ||
      fields.paymentReference.length < 2 ||
      fields.paymentReference.length > 100)
  )
    throw new BadRequestException(
      'Payment reference must contain 2–100 characters',
    );
  if (
    fields.cashTender !== undefined &&
    !/^\d{1,22}(?:\.\d{1,2})?$/.test(fields.cashTender)
  )
    throw new BadRequestException('Invalid cash tender');
  return {
    paymentAccountId: account.id,
    paymentAccountName: account.name,
    paymentAccountIsCash: cash,
    paymentAccountRequiresReference: account.requiresReference,
  };
}
