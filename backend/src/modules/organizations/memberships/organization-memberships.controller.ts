import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationMemberResponseDto } from '../../../openapi/response.dto';
import { OrganizationRole } from '../../../generated/prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import { OrganizationMembershipsService } from './organization-memberships.service';
import type { OrganizationMember } from './organization-memberships.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@ApiTags('organization members')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiNotFoundResponse({ description: 'Organization or member was not found' })
@Controller('organizations/:organizationId/members')
export class OrganizationMembershipsController {
  constructor(
    private readonly membershipsService: OrganizationMembershipsService,
  ) {}

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Get()
  @ApiOperation({ summary: 'List organization members' })
  @ApiOkResponse({ type: OrganizationMemberResponseDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'The organization role cannot list members',
  })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
  ): Promise<OrganizationMember[]> {
    return this.membershipsService.findAll(organization.organizationId);
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Add a registered user to the organization' })
  @ApiCreatedResponse({ type: OrganizationMemberResponseDto })
  @ApiForbiddenResponse({ description: 'Only owners can add members' })
  @ApiConflictResponse({ description: 'The user is already a member' })
  add(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    return this.membershipsService.add(organization.organizationId, dto);
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Patch(':userId/role')
  @ApiOperation({ summary: 'Change an organization member role' })
  @ApiOkResponse({ type: OrganizationMemberResponseDto })
  @ApiForbiddenResponse({ description: 'Only owners can change member roles' })
  @ApiConflictResponse({
    description: 'The operation would remove the last owner',
  })
  updateRole(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMember> {
    return this.membershipsService.updateRole(
      organization.organizationId,
      userId,
      dto,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  @ApiOperation({ summary: 'Remove an organization member' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Only owners can remove members' })
  @ApiConflictResponse({
    description: 'The operation would remove the last owner',
  })
  remove(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.membershipsService.remove(organization.organizationId, userId);
  }
}
