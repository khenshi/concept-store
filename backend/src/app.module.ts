import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { validateEnvironment } from './config/env.validation';
import { STANDARD_RATE_LIMIT } from './config/rate-limit';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantAgreementsModule } from './modules/merchant-agreements/merchant-agreements.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { SalesModule } from './modules/sales/sales.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { SpacesModule } from './modules/spaces/spaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([STANDARD_RATE_LIMIT]),
    PrismaModule,
    AuthModule,
    InventoryModule,
    MerchantAgreementsModule,
    OrganizationsModule,
    MerchantsModule,
    ProductsModule,
    RefundsModule,
    SalesModule,
    SettlementsModule,
    SpacesModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
