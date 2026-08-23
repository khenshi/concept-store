import type { Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser, RefreshSession } from '../auth.types';

export type SessionPersistenceClient = Pick<
  Prisma.TransactionClient,
  'userSession'
>;

export interface RotatedSession {
  user: AuthenticatedUser;
  refreshSession: RefreshSession;
}
