import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { RefundCommandQueryDto } from './dto/create-refund.dto';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { RefundReadService } from './refund-read.service';
import { CompletedRefundResponseDto } from './refunds.types';
import {
  MerchantRefundPageDto,
  MerchantRefundResponseDto,
  StaffRefundPageDto,
} from './refund-read.types';
@Controller(
  'organizations/:organizationId/branches/:branchId/sales/:saleId/refunds',
)
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles('OWNER', 'MANAGER', 'MERCHANT')
@ApiTags('refunds')
@ApiBearerAuth('access-token')
@ApiExtraModels(
  CompletedRefundResponseDto,
  MerchantRefundResponseDto,
  StaffRefundPageDto,
  MerchantRefundPageDto,
)
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Current role cannot read refunds' })
@ApiNotFoundResponse({
  description:
    'Organization, accessible branch, sale or matching refund not found',
})
@ApiBadRequestResponse({
  description: 'Invalid UUID, pagination or unknown query fields',
})
export class RefundReadController {
  constructor(private readonly refunds: RefundReadService) {}
  @Get()
  @ApiOperation({
    summary:
      'Paginated permitted refunds and all-refund remaining original item quantities',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffRefundPageDto) },
        { $ref: getSchemaPath(MerchantRefundPageDto) },
      ],
      discriminator: { propertyName: 'scope' },
    },
  })
  findAll(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Query() query: ListRefundsQueryDto,
  ) {
    return this.refunds.findAll(
      context,
      branchId.toLowerCase(),
      saleId.toLowerCase(),
      query,
    );
  }
  @Get(':refundId')
  @ApiOperation({
    summary: 'Read a permitted immutable staff or own-item merchant refund',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CompletedRefundResponseDto) },
        { $ref: getSchemaPath(MerchantRefundResponseDto) },
      ],
      discriminator: { propertyName: 'scope' },
    },
  })
  findOne(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Param('refundId', new ParseUUIDPipe({ version: '4' })) refundId: string,
    @Query() query: RefundCommandQueryDto,
  ) {
    void query;
    return this.refunds.findOne(
      context,
      branchId.toLowerCase(),
      saleId.toLowerCase(),
      refundId.toLowerCase(),
    );
  }
}
