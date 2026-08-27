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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import {
  CreatedOrganizationInvitationResponseDto,
  OrganizationInvitationResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { OrganizationInvitationsService } from './organization-invitations.service';
import type {
  CreatedOrganizationInvitation,
  OrganizationInvitationView,
} from './organization-invitations.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER)
@ApiTags('organization invitations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'Only organization owners can manage invitations',
})
@Controller('organizations/:organizationId/invitations')
export class OrganizationInvitationsController {
  constructor(
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a single-use organization invitation' })
  @ApiCreatedResponse({ type: CreatedOrganizationInvitationResponseDto })
  @ApiConflictResponse({ description: 'The email is already a member' })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateOrganizationInvitationDto,
  ): Promise<CreatedOrganizationInvitation> {
    return this.invitationsService.create(
      organization.organizationId,
      user,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List organization invitations' })
  @ApiOkResponse({ type: OrganizationInvitationResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
  ): Promise<OrganizationInvitationView[]> {
    return this.invitationsService.findAll(organization.organizationId);
  }

  @Patch(':invitationId/revoke')
  @ApiOperation({ summary: 'Revoke a pending organization invitation' })
  @ApiOkResponse({ type: OrganizationInvitationResponseDto })
  @ApiConflictResponse({ description: 'The invitation is no longer pending' })
  revoke(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
  ): Promise<OrganizationInvitationView> {
    return this.invitationsService.revoke(
      organization.organizationId,
      invitationId,
    );
  }
}
