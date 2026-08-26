import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantAgreementsModule } from './modules/merchant-agreements/merchant-agreements.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { SpacesModule } from './modules/spaces/spaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    MerchantAgreementsModule,
    OrganizationsModule,
    MerchantsModule,
    ProductsModule,
    SpacesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
