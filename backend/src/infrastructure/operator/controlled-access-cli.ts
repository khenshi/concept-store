import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  OrganizationStatus,
} from '../../generated/prisma/client';
import {
  OrganizationLifecycleService,
  type OrganizationStatusCommandInput,
  type ProvisionOrganizationInput,
} from '../../modules/organizations/organization-lifecycle.service';

const CONFIRMATION = 'I_UNDERSTAND_CONTROLLED_ACCESS';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.OPERATOR_COMMAND_CONFIRM !== CONFIRMATION) {
    throw new Error('Controlled access command confirmation is required');
  }

  const connectionString = required('DIRECT_DATABASE_URL');
  const action = required('OPERATOR_ACTION');
  const operatorIdentity = required('OPERATOR_IDENTITY');
  const operationId = required('OPERATION_ID');
  const reason = required('OPERATOR_REASON');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const service = new OrganizationLifecycleService(prisma as never);

  try {
    if (action === 'provision') {
      const input: ProvisionOrganizationInput = {
        name: required('ORGANIZATION_NAME'),
        ownerUserId: required('OWNER_USER_ID'),
        operatorIdentity,
        operationId,
        reason,
      };
      const result = await service.provision(input);
      console.info(
        JSON.stringify({
          action,
          organizationId: result.id,
          status: result.status,
        }),
      );
      return;
    }

    if (action === 'activate' || action === 'deactivate') {
      const input: OrganizationStatusCommandInput = {
        organizationId: required('ORGANIZATION_ID'),
        expectedStatus: required('EXPECTED_STATUS') as OrganizationStatus,
        operatorIdentity,
        operationId,
        reason,
      };
      if (action === 'activate') await service.activate(input);
      else await service.deactivate(input);
      console.info(
        JSON.stringify({ action, organizationId: input.organizationId }),
      );
      return;
    }

    throw new Error(
      'OPERATOR_ACTION must be provision, activate, or deactivate',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Controlled access command failed',
  );
  process.exitCode = 1;
});
