import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
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
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import { CompletedSaleResponseDto } from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('organizations/:organizationId/branches/:branchId/sales')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
)
@ApiTags('sales')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Current role cannot complete checkout' })
@ApiNotFoundResponse({
  description: 'Organization, accessible branch, or branch inventory not found',
})
@ApiBadRequestResponse({
  description:
    'Invalid command, unknown fields, duplicate lines, or insufficient cash tender',
})
@ApiConflictResponse({
  description:
    'PRICE_CHANGED, INSUFFICIENT_STOCK, PRODUCT_UNAVAILABLE, REQUEST_ID_CONFLICT, or CHECKOUT_RETRY; no partial writes',
})
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}
  @Post()
  @ApiOperation({
    summary:
      'Atomically complete checkout or replay the original actor’s identical command',
  })
  @ApiCreatedResponse({ type: CompletedSaleResponseDto })
  complete(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.checkout.complete(context, branchId, dto);
  }
}
