import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  CreateRefundDto,
  RefundCommandQueryDto,
} from './dto/create-refund.dto';
import { CompletedRefundResponseDto } from './refunds.types';
import { RefundsService } from './refunds.service';
@Controller(
  'organizations/:organizationId/branches/:branchId/sales/:saleId/refunds',
)
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles('OWNER', 'MANAGER')
@ApiTags('refunds')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Current role cannot issue refunds' })
@ApiNotFoundResponse({
  description:
    'Organization, accessible branch, sale or original item not found',
})
@ApiBadRequestResponse({
  description:
    'Invalid command, unknown fields/query, duplicate lines or missing refund confirmation',
})
@ApiConflictResponse({
  description:
    'RETURN_QUANTITY_EXCEEDED, STOCK_OVERFLOW, REQUEST_ID_CONFLICT or REFUND_RETRY; no partial writes',
})
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}
  @Post()
  @ApiCreatedResponse({ type: CompletedRefundResponseDto })
  @ApiOperation({
    summary:
      'Record an issued manual item refund atomically, or replay the same actor’s unchanged command',
  })
  complete(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() dto: CreateRefundDto,
    @Query() _query: RefundCommandQueryDto,
  ) {
    void _query;
    return this.refunds.complete(
      context,
      branchId.toLowerCase(),
      saleId.toLowerCase(),
      dto,
    );
  }
}
