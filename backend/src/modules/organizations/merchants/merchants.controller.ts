import { MerchantIdentityResponseDto } from '../../../openapi/response.dto';
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
  ApiExtraModels,
  getSchemaPath,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import { MerchantResponseDto } from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { ResourceAccessGuard } from '../authorization/resource-access.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantsService } from './merchants.service';
import type { MerchantRecord } from './merchants.types';

@UseGuards(AuthGuard, OrganizationAccessGuard, ResourceAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.MERCHANT,
)
@ApiExtraModels(MerchantResponseDto, MerchantIdentityResponseDto)
@ApiTags('merchants')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage merchants',
})
@ApiNotFoundResponse({ description: 'Organization or merchant was not found' })
@Controller('organizations/:organizationId/merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @OrganizationRoles(OrganizationRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Create a merchant profile' })
  @ApiCreatedResponse({ type: MerchantResponseDto })
  @ApiConflictResponse({ description: 'The merchant code already exists' })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateMerchantDto,
  ): Promise<MerchantRecord> {
    return this.merchantsService.create(organization.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List merchant profiles in the organization' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(MerchantResponseDto) },
          { $ref: getSchemaPath(MerchantIdentityResponseDto) },
        ],
      },
    },
  })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListMerchantsQueryDto,
  ) {
    return this.merchantsService.findAll(
      organization.organizationId,
      query,
      organization,
    );
  }

  @Get(':merchantId')
  @ApiOperation({ summary: 'Get a merchant profile' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(MerchantResponseDto) },
        { $ref: getSchemaPath(MerchantIdentityResponseDto) },
      ],
    },
  })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
  ) {
    return this.merchantsService.findOne(
      organization.organizationId,
      merchantId,
      organization,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Patch(':merchantId')
  @ApiOperation({ summary: 'Update a merchant profile' })
  @ApiOkResponse({ type: MerchantResponseDto })
  @ApiConflictResponse({ description: 'The merchant code already exists' })
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

  @OrganizationRoles(OrganizationRole.OWNER)
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
}
