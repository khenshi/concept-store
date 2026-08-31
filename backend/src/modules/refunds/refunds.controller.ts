import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('refunds')
@ApiBearerAuth('access-token')
@Controller(
  'organizations/:organizationId/branches/:branchId/pos/sales/:saleId/refunds',
)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a completed item refund' })
  @ApiCreatedResponse({ description: 'Refund recorded' })
  @ApiConflictResponse({
    description: 'Quantity was already refunded or changed concurrently',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.refunds.create(
      organization.organizationId,
      branchId,
      saleId,
      organization.userId,
      dto,
    );
  }
}
