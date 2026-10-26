import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  BranchPaymentAccountsQueryDto,
  CreatePaymentAccountDto,
  PaymentAccountResponseDto,
  UpdatePaymentAccountDto,
} from './payment-account.dto';
import { PaymentAccountsService } from './payment-accounts.service';

@Controller('organizations/:organizationId/payment-accounts')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER)
@ApiTags('payment-accounts')
@ApiBearerAuth('access-token')
export class PaymentAccountsController {
  constructor(private readonly accounts: PaymentAccountsService) {}
  @Get()
  @ApiOkResponse({ type: [PaymentAccountResponseDto] })
  list(@CurrentOrganization() context: OrganizationContext) {
    return this.accounts.list(context);
  }
  @Post()
  @ApiCreatedResponse({ type: PaymentAccountResponseDto })
  create(
    @CurrentOrganization() context: OrganizationContext,
    @Body() dto: CreatePaymentAccountDto,
  ) {
    return this.accounts.save(context, dto);
  }
  @Patch(':accountId')
  @ApiOkResponse({ type: PaymentAccountResponseDto })
  update(
    @CurrentOrganization() context: OrganizationContext,
    @Param('accountId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePaymentAccountDto,
  ) {
    return this.accounts.save(context, dto, id);
  }
}
@Controller('organizations/:organizationId/branches/:branchId/payment-accounts')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
)
@ApiTags('payment-accounts')
@ApiBearerAuth('access-token')
export class BranchPaymentAccountsController {
  constructor(private readonly accounts: PaymentAccountsService) {}
  @Get()
  @ApiOkResponse({ type: [PaymentAccountResponseDto] })
  list(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: BranchPaymentAccountsQueryDto,
  ) {
    return this.accounts.available(context, branchId, query);
  }
}
