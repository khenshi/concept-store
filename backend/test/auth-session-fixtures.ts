import { randomUUID } from 'node:crypto';

const sessionIds = new Map<string, string>();

export function sessionIdFor(userId: string): string {
  let id = sessionIds.get(userId);
  if (!id) {
    id = randomUUID();
    sessionIds.set(userId, id);
  }
  return id;
}

export type ActiveSessionUserQuery = {
  id: string;
  deletedAt: null;
  sessions: { some: { id: string; revokedAt: null; expiresAt: { gt: Date } } };
};

export function matchesActiveSession(where: ActiveSessionUserQuery): boolean {
  return (
    where.deletedAt === null &&
    where.sessions?.some.id === sessionIdFor(where.id) &&
    where.sessions.some.revokedAt === null &&
    where.sessions.some.expiresAt.gt instanceof Date
  );
}
