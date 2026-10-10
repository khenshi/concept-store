import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { MerchantBranchStatus } from '../../../generated/prisma/client';
import {
  BranchIdentityResponseDto,
  MerchantIdentityResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  EmptyMerchantBranchDto,
  ListMerchantBranchesDto,
  MerchantBranchStatusDto,
} from './dto/merchant-branch.dto';
import { MerchantBranchesService } from './merchant-branches.service';

export class MerchantBranchResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ enum: MerchantBranchStatus }) status!: MerchantBranchStatus;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: BranchIdentityResponseDto })
  branch!: BranchIdentityResponseDto;
  @ApiProperty({ type: MerchantIdentityResponseDto })
  merchant!: MerchantIdentityResponseDto;
}
export class MerchantBranchPageResponseDto {
  @ApiProperty({ type: [MerchantBranchResponseDto] })
  items!: MerchantBranchResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty({ enum: [10] }) limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNext!: boolean;
}

@Controller('organizations/:organizationId')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles('OWNER', 'MANAGER', 'MERCHANT')
@ApiTags('merchant-branches')
@ApiBearerAuth('access-token')
@ApiBadRequestResponse({ description: 'Invalid UUID, query or command' })
@ApiForbiddenResponse({
  description: 'Current role cannot perform this action',
})
@ApiNotFoundResponse({ description: 'Related object or association not found' })
@ApiConflictResponse({
  description: 'Concurrent association change; refresh and retry',
})
export class MerchantBranchesController {
  constructor(private readonly service: MerchantBranchesService) {}

  @Get('merchants/:merchantId/branches')
  @ApiOperation({ summary: 'List branches associated with this merchant' })
  @ApiOkResponse({ type: MerchantBranchPageResponseDto })
  merchantBranches(
    @CurrentOrganization() context: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ListMerchantBranchesDto,
  ) {
    return this.service.list(context, 'merchant', id, query);
  }
  @Get('branches/:branchId/merchants')
  @ApiOperation({ summary: 'List merchants associated with this branch' })
  @ApiOkResponse({ type: MerchantBranchPageResponseDto })
  branchMerchants(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ListMerchantBranchesDto,
  ) {
    return this.service.list(context, 'branch', id, query);
  }
  @Put('merchants/:merchantId/branches/:branchId')
  @OrganizationRoles('OWNER')
  @ApiOperation({
    summary: 'Assign a merchant to a branch without changing existing status',
  })
  @ApiOkResponse({ type: MerchantBranchResponseDto })
  assign(
    @CurrentOrganization() context: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() body: EmptyMerchantBranchDto,
  ) {
    void body;
    return this.service.assign(context, merchantId, branchId);
  }
  @Patch('merchants/:merchantId/branches/:branchId/status')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Activate or deactivate branch participation' })
  @ApiOkResponse({ type: MerchantBranchResponseDto })
  status(
    @CurrentOrganization() context: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() body: MerchantBranchStatusDto,
  ) {
    return this.service.setStatus(context, merchantId, branchId, body.status);
  }
}
