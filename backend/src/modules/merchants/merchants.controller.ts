import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import { MerchantResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import { UpdateMerchantBranchesDto } from './dto/update-merchant-branches.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import type { MerchantRecord } from './merchant.types';
import { MerchantsService } from './merchants.service';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('merchants')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot access merchant management',
})
@ApiNotFoundResponse({ description: 'Organization or merchant was not found' })
@Controller('organizations/:organizationId/merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a merchant' })
  @ApiCreatedResponse({ type: MerchantResponseDto })
  @ApiConflictResponse({
    description: 'The merchant code already exists in the organization',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateMerchantDto,
  ): Promise<MerchantRecord> {
    return this.merchantsService.create(organization.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter merchants in the organization' })
  @ApiOkResponse({ type: MerchantResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListMerchantsQueryDto,
  ): Promise<MerchantRecord[]> {
    return this.merchantsService.findAll(organization.organizationId, query);
  }

  @Get(':merchantId')
  @ApiOperation({ summary: 'Get a merchant in the organization' })
  @ApiOkResponse({ type: MerchantResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
  ): Promise<MerchantRecord> {
    return this.merchantsService.findOne(
      organization.organizationId,
      merchantId,
    );
  }

  @Patch(':merchantId')
  @ApiOperation({ summary: 'Update a merchant profile' })
  @ApiOkResponse({ type: MerchantResponseDto })
  @ApiConflictResponse({
    description: 'The merchant code already exists in the organization',
  })
  update(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ): Promise<MerchantRecord> {
    return this.merchantsService.update(
      organization.organizationId,
      merchantId,
      dto,
    );
  }

  @Patch(':merchantId/status')
  @ApiOperation({ summary: 'Change a merchant lifecycle status' })
  @ApiOkResponse({ type: MerchantResponseDto })
  updateStatus(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: UpdateMerchantStatusDto,
  ): Promise<MerchantRecord> {
    return this.merchantsService.updateStatus(
      organization.organizationId,
      merchantId,
      dto,
    );
  }

  @Put(':merchantId/branches')
  @ApiOperation({ summary: 'Replace the branches where a merchant operates' })
  @ApiOkResponse({ type: MerchantResponseDto })
  updateBranches(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: UpdateMerchantBranchesDto,
  ): Promise<MerchantRecord> {
    return this.merchantsService.updateBranches(
      organization.organizationId,
      merchantId,
      dto,
    );
  }
}
