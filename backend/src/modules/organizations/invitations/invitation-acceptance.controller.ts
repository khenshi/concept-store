import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AcceptedOrganizationInvitationResponseDto,
  OrganizationInvitationPreviewResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { OrganizationInvitationsService } from './organization-invitations.service';
import type {
  AcceptedOrganizationInvitation,
  OrganizationInvitationPreview,
} from './organization-invitations.types';

@ApiTags('organization invitations')
@ApiNotFoundResponse({ description: 'Invitation is invalid or unavailable' })
@Controller('organization-invitations')
export class InvitationAcceptanceController {
  constructor(
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an organization invitation' })
  @ApiOkResponse({ type: OrganizationInvitationPreviewResponseDto })
  preview(
    @Param('token') token: string,
  ): Promise<OrganizationInvitationPreview> {
    return this.invitationsService.preview(token);
  }

  @UseGuards(AuthGuard)
  @Post(':token/accept')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Accept an organization invitation' })
  @ApiOkResponse({ type: AcceptedOrganizationInvitationResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'The signed-in email does not match' })
  accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<AcceptedOrganizationInvitation> {
    return this.invitationsService.accept(token, user);
  }
}
