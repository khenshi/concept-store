import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { ListMerchantReceivablesQueryDto } from './dto/list-merchant-receivables-query.dto';
import { MerchantReceivablesService } from './merchant-receivables.service';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('merchant receivables')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'The role cannot manage receivables' })
@ApiNotFoundResponse({ description: 'Merchant receivable was not found' })
@Controller('organizations/:organizationId/merchant-receivables')
export class MerchantReceivablesController {
  constructor(
    private readonly merchantReceivablesService: MerchantReceivablesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List merchant rent receivables' })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListMerchantReceivablesQueryDto,
  ) {
    return this.merchantReceivablesService.findAll(
      organization.organizationId,
      query,
    );
  }

  @Get(':receivableId')
  @ApiOperation({ summary: 'Get a merchant rent receivable and its history' })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('receivableId', new ParseUUIDPipe({ version: '4' }))
    receivableId: string,
  ) {
    return this.merchantReceivablesService.findOne(
      organization.organizationId,
      receivableId,
    );
  }
}
