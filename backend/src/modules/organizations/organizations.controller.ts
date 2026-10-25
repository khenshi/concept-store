import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationAccessResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import type { OrganizationAccess } from './organizations.types';
import { OrganizationsService } from './organizations.service';
import { OrganizationAccessGuard } from './authorization/organization-access.guard';
import { OrganizationRoles } from './authorization/organization-roles.decorator';
import { OrganizationRole } from '../../generated/prisma/client';

@UseGuards(AuthGuard)
@ApiTags('organizations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @UseGuards(VerifiedEmailGuard)
  @Get()
  @ApiOperation({ summary: 'List organizations available to the current user' })
  @ApiOkResponse({ type: OrganizationAccessResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<OrganizationAccess[]> {
    return this.organizationsService.findAllForUser(user.id);
  }

  @UseGuards(OrganizationAccessGuard)
  @Get(':organizationId')
  @ApiOperation({
    summary: 'Get an organization available to the current user',
  })
  @ApiOkResponse({ type: OrganizationAccessResponseDto })
  @ApiNotFoundResponse({
    description: 'Organization is unavailable to the user',
  })
  findOne(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.findOneForUser(user.id, organizationId);
  }

  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.OWNER)
  @Patch(':organizationId')
  @ApiOperation({ summary: 'Rename the current owner organization' })
  @ApiOkResponse({ type: OrganizationAccessResponseDto })
  @ApiForbiddenResponse({ description: 'Only owners can rename organizations' })
  rename(
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.rename(organizationId, dto.name);
  }
}
