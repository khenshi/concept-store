import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MerchantAgreementsController } from './merchant-agreements.controller';
import { MerchantAgreementsService } from './merchant-agreements.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [MerchantAgreementsController],
  providers: [MerchantAgreementsService],
})
export class MerchantAgreementsModule {}
