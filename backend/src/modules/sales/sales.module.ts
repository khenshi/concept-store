import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PosProductsController } from './pos-products.controller';
import { PosProductsService } from './pos-products.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [PosProductsController],
  providers: [PosProductsService],
})
export class SalesModule {}
