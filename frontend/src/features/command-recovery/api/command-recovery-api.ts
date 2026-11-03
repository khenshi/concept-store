import { z } from 'zod';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';

export type CommandRecoveryKind = 'CHECKOUT' | 'REFUND';
export type CommandRecoveryCommand = Record<string, unknown>;
const uuid = z.uuidv4();
const recoverySchema = z
  .object({
    id: uuid,
    kind: z.enum(['CHECKOUT', 'REFUND']),
    state: z.enum([
      'PREPARED',
      'SUBMITTED',
      'COMPLETED',
      'ACKNOWLEDGED',
      'ABANDONED',
    ]),
    requestId: uuid,
    branchId: uuid,
    saleId: uuid.nullable(),
    command: z.record(z.string(), z.unknown()),
    sourceId: uuid.nullable(),
    createdAt: z.string().datetime(),
    submittedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    acknowledgedAt: z.string().datetime().nullable(),
    closedAt: z.string().datetime().nullable(),
    result: z.unknown().nullable(),
  })
  .strict();
export type CommandRecovery = z.infer<typeof recoverySchema>;
const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/command-recovery`;

export async function prepareCommandRecovery(
  request: AuthenticatedRequest,
  organizationId: string,
  input: {
    kind: CommandRecoveryKind;
    branchId: string;
    saleId?: string;
    command: CommandRecoveryCommand;
  },
) {
  return recoverySchema.parse(
    await request<unknown>(path(organizationId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function listCommandRecoveries(
  request: AuthenticatedRequest,
  organizationId: string,
  kind?: CommandRecoveryKind,
) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return z
    .array(recoverySchema)
    .parse(await request<unknown>(`${path(organizationId)}${query}`));
}

export async function getCommandRecovery(
  request: AuthenticatedRequest,
  organizationId: string,
  id: string,
) {
  return recoverySchema.parse(
    await request<unknown>(`${path(organizationId)}/${encodeURIComponent(id)}`),
  );
}

async function postRecoveryAction(
  request: AuthenticatedRequest,
  organizationId: string,
  id: string,
  action: 'submit' | 'acknowledge' | 'abandon',
) {
  return recoverySchema.parse(
    await request<unknown>(
      `${path(organizationId)}/${encodeURIComponent(id)}/${action}`,
      { method: 'POST' },
    ),
  );
}

export function submitCommandRecovery(
  request: AuthenticatedRequest,
  organizationId: string,
  id: string,
) {
  return postRecoveryAction(request, organizationId, id, 'submit');
}

export function acknowledgeCommandRecovery(
  request: AuthenticatedRequest,
  organizationId: string,
  id: string,
) {
  return postRecoveryAction(request, organizationId, id, 'acknowledge');
}

export function abandonCommandRecovery(
  request: AuthenticatedRequest,
  organizationId: string,
  id: string,
) {
  return postRecoveryAction(request, organizationId, id, 'abandon');
}
