import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AgreementPrepaymentKind,
  OrganizationRole,
} from '../../generated/prisma/client';
import {
  AgreementPrepaymentResponseDto,
  AgreementPrepaymentTransactionResponseDto,
  MerchantAgreementWorkflowResponseDto,
  SpaceAvailabilityResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateMerchantAgreementDto } from './dto/create-merchant-agreement.dto';
import { UpdateMerchantAgreementDto } from './dto/update-merchant-agreement.dto';
import {
  AgreementReasonDto,
  CancelAgreementDto,
  RecordDepositDeductionDto,
  RecordPrepaymentCollectionDto,
  RecordPrepaymentRefundDto,
} from './dto/agreement-transition.dto';
import { SpaceAvailabilityQueryDto } from './dto/space-availability-query.dto';
import { MerchantAgreementsService } from './merchant-agreements.service';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('merchant agreements')
@ApiBearerAuth('access-token')
@Controller('organizations/:organizationId')
export class MerchantAgreementsController {
  constructor(private readonly service: MerchantAgreementsService) {}

  @Post('merchants/:merchantId/agreements')
  @ApiOperation({ summary: 'Create a merchant agreement draft' })
  @ApiCreatedResponse({ type: MerchantAgreementWorkflowResponseDto })
  create(
    @CurrentOrganization() org: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: CreateMerchantAgreementDto,
  ) {
    return this.service.create(org.organizationId, merchantId, dto);
  }
  @Get('merchant-agreements')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto, isArray: true })
  findAllForOrganization(@CurrentOrganization() org: OrganizationContext) {
    return this.service.findAllForOrganization(org.organizationId);
  }
  @Get('merchants/:merchantId/agreements')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() org: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
  ) {
    return this.service.findAll(org.organizationId, merchantId);
  }
  @Get('merchant-agreements/:agreementId')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  findOne(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.findOneView(org.organizationId, id);
  }
  @Patch('merchant-agreements/:agreementId')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  update(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMerchantAgreementDto,
  ) {
    return this.service.update(org.organizationId, id, dto);
  }
  @Post('merchant-agreements/:agreementId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  submit(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.submit(org.organizationId, id, org.userId);
  }
  @Patch('merchant-agreements/:agreementId/withdraw')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  withdraw(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AgreementReasonDto,
  ) {
    return this.service.withdraw(
      org.organizationId,
      id,
      org.userId,
      dto.reason,
    );
  }
  @Patch('merchant-agreements/:agreementId/return-to-draft')
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  returnToDraft(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AgreementReasonDto,
  ) {
    return this.service.returnToDraft(
      org.organizationId,
      id,
      org.userId,
      dto.reason,
    );
  }
  @Patch('merchant-agreements/:agreementId/approve')
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  approve(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.approve(org.organizationId, id, org.userId);
  }
  @Patch('merchant-agreements/:agreementId/activate')
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  activate(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.activate(org.organizationId, id, org.userId);
  }
  @Patch('merchant-agreements/:agreementId/cancel')
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  cancel(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelAgreementDto,
  ) {
    return this.service.cancel(org.organizationId, id, org.userId, dto);
  }
  @Patch('merchant-agreements/:agreementId/suspend')
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  suspend(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AgreementReasonDto,
  ) {
    return this.service.suspend(org.organizationId, id, org.userId, dto.reason);
  }
  @Patch('merchant-agreements/:agreementId/discard')
  @ApiOkResponse({ type: MerchantAgreementWorkflowResponseDto })
  discard(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AgreementReasonDto,
  ) {
    return this.service.discard(org.organizationId, id, org.userId, dto.reason);
  }
  @Get('merchant-agreements/:agreementId/prepayments')
  @ApiOkResponse({ type: AgreementPrepaymentResponseDto, isArray: true })
  prepayments(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.listPrepayments(org.organizationId, id);
  }
  @Post('merchant-agreements/:agreementId/prepayments/:kind/collections')
  @ApiCreatedResponse({ type: AgreementPrepaymentTransactionResponseDto })
  collect(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('kind', new ParseEnumPipe(AgreementPrepaymentKind))
    kind: AgreementPrepaymentKind,
    @Body() dto: RecordPrepaymentCollectionDto,
  ) {
    return this.service.collect(org.organizationId, id, kind, org.userId, dto);
  }
  @Post('merchant-agreements/:agreementId/prepayments/:kind/refunds')
  @ApiCreatedResponse({ type: AgreementPrepaymentTransactionResponseDto })
  refund(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('kind', new ParseEnumPipe(AgreementPrepaymentKind))
    kind: AgreementPrepaymentKind,
    @Body() dto: RecordPrepaymentRefundDto,
  ) {
    return this.service.refund(org.organizationId, id, kind, org.userId, dto);
  }
  @Post('merchant-agreements/:agreementId/security-deposit/deductions')
  @ApiCreatedResponse({ type: AgreementPrepaymentTransactionResponseDto })
  deduct(
    @CurrentOrganization() org: OrganizationContext,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RecordDepositDeductionDto,
  ) {
    return this.service.deductDeposit(org.organizationId, id, org.userId, dto);
  }
  @Get('spaces/availability')
  @ApiOkResponse({ type: SpaceAvailabilityResponseDto, isArray: true })
  availability(
    @CurrentOrganization() org: OrganizationContext,
    @Query() query: SpaceAvailabilityQueryDto,
  ) {
    return this.service.availability(org.organizationId, query);
  }
}
