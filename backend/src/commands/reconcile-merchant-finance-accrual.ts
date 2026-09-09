import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MerchantFinanceAccrualReconciliationService } from '../modules/merchant-finance-accrual/merchant-finance-accrual-reconciliation.service';

function parseArguments(args: string[]): {
  repair: boolean;
  organizationId?: string;
} {
  let repair = false;
  let organizationId: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--repair') repair = true;
    else if (argument === '--organization') {
      organizationId = args[index + 1];
      index += 1;
      if (!organizationId) throw new Error('--organization requires an ID');
    } else if (argument.startsWith('--organization=')) {
      organizationId = argument.slice('--organization='.length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { repair, organizationId };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const reconciliation = application.get(
      MerchantFinanceAccrualReconciliationService,
    );
    const report = await reconciliation.run(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await application.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Finance reconciliation failed'}\n`,
  );
  process.exitCode = 1;
});
