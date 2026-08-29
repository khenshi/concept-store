import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import {
  SalePageResponseDto,
  SaleResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { SalesService } from './sales.service';
import type { SalePageRecord, SaleRecord } from './sales.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
)
@ApiTags('pos')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'The organization role cannot use POS' })
@ApiNotFoundResponse({ description: 'Branch was not found' })
@Controller('organizations/:organizationId/branches/:branchId/pos/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'List completed branch sales' })
  @ApiOkResponse({ type: SalePageResponseDto })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: ListSalesQueryDto,
  ): Promise<SalePageRecord> {
    return this.salesService.findAll(
      organization.organizationId,
      branchId,
      query,
    );
  }

  @Get(':saleId')
  @ApiOperation({ summary: 'Get completed sale details' })
  @ApiOkResponse({ type: SaleResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
  ): Promise<SaleRecord> {
    return this.salesService.findOne(
      organization.organizationId,
      branchId,
      saleId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete an online POS sale' })
  @ApiCreatedResponse({ type: SaleResponseDto })
  @ApiBadRequestResponse({
    description: 'Checkout payload or payment reference is invalid',
  })
  @ApiConflictResponse({
    description: 'Product, inventory, payment, or concurrent checkout conflict',
  })
  checkout(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleRecord> {
    return this.salesService.checkout(
      organization.organizationId,
      branchId,
      organization.userId,
      dto,
    );
  }
}
