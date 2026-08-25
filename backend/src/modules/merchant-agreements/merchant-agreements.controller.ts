import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { MerchantAgreementResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateMerchantAgreementDto } from './dto/create-merchant-agreement.dto';
import { EndMerchantAgreementDto } from './dto/end-merchant-agreement.dto';
import { UpdateMerchantAgreementDto } from './dto/update-merchant-agreement.dto';
import { MerchantAgreementsService } from './merchant-agreements.service';
import type { MerchantAgreementRecord } from './merchant-agreements.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('merchant agreements')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage merchant agreements',
})
@ApiNotFoundResponse({
  description: 'Organization, merchant, or agreement was not found',
})
@Controller('organizations/:organizationId')
export class MerchantAgreementsController {
  constructor(
    private readonly merchantAgreementsService: MerchantAgreementsService,
  ) {}

  @Post('merchants/:merchantId/agreements')
  @ApiOperation({ summary: 'Create a draft merchant agreement' })
  @ApiCreatedResponse({ type: MerchantAgreementResponseDto })
  @ApiBadRequestResponse({
    description: 'Agreement terms or dates are invalid',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: CreateMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    return this.merchantAgreementsService.create(
      organization.organizationId,
      merchantId,
      dto,
    );
  }

  @Get('merchants/:merchantId/agreements')
  @ApiOperation({ summary: 'List a merchant agreement history' })
  @ApiOkResponse({ type: MerchantAgreementResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
  ): Promise<MerchantAgreementRecord[]> {
    return this.merchantAgreementsService.findAll(
      organization.organizationId,
      merchantId,
    );
  }

  @Get('merchant-agreements/:agreementId')
  @ApiOperation({ summary: 'Get a merchant agreement' })
  @ApiOkResponse({ type: MerchantAgreementResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ): Promise<MerchantAgreementRecord> {
    return this.merchantAgreementsService.findOne(
      organization.organizationId,
      agreementId,
    );
  }

  @Patch('merchant-agreements/:agreementId')
  @ApiOperation({ summary: 'Update a draft merchant agreement' })
  @ApiOkResponse({ type: MerchantAgreementResponseDto })
  @ApiConflictResponse({ description: 'The agreement is not a draft' })
  update(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() dto: UpdateMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    return this.merchantAgreementsService.update(
      organization.organizationId,
      agreementId,
      dto,
    );
  }

  @Patch('merchant-agreements/:agreementId/activate')
  @ApiOperation({ summary: 'Activate a draft merchant agreement' })
  @ApiOkResponse({ type: MerchantAgreementResponseDto })
  @ApiConflictResponse({
    description: 'The agreement cannot be activated in its current state',
  })
  activate(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ): Promise<MerchantAgreementRecord> {
    return this.merchantAgreementsService.activate(
      organization.organizationId,
      agreementId,
    );
  }

  @Patch('merchant-agreements/:agreementId/end')
  @ApiOperation({ summary: 'End an active merchant agreement' })
  @ApiOkResponse({ type: MerchantAgreementResponseDto })
  @ApiBadRequestResponse({ description: 'The end date is invalid' })
  @ApiConflictResponse({ description: 'The agreement is not active' })
  end(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() dto: EndMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    return this.merchantAgreementsService.end(
      organization.organizationId,
      agreementId,
      dto,
    );
  }
}
