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
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import { OrganizationMembershipsService } from './organization-memberships.service';
import {
  EmptyAssignmentDto,
  UpdateMemberMerchantDto,
} from './dto/update-member-merchant.dto';
import {
  MemberBranchResponse,
  MemberMerchantResponse,
} from './member-access.response';
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

  @OrganizationRoles(OrganizationRole.OWNER)
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
  @Get(':userId/branches')
  @ApiOperation({
    summary: 'List a member’s explicit branches, or all branches for an owner',
  })
  @ApiOkResponse({ type: MemberBranchResponse, isArray: true })
  findBranches(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return this.membershipsService.findBranches(
      organization.organizationId,
      userId,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Put(':userId/branches/:branchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Grant a branch assignment idempotently' })
  @ApiNoContentResponse()
  @ApiConflictResponse({
    description: 'Owner has implicit access or membership changed concurrently',
  })
  grantBranch(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() _dto: EmptyAssignmentDto,
  ) {
    void _dto;
    return this.membershipsService.setBranch(
      organization.organizationId,
      userId,
      branchId,
      true,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Delete(':userId/branches/:branchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a branch assignment idempotently' })
  @ApiNoContentResponse()
  @ApiConflictResponse({
    description: 'Owner has implicit access or membership changed concurrently',
  })
  revokeBranch(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() _dto: EmptyAssignmentDto,
  ) {
    void _dto;
    return this.membershipsService.setBranch(
      organization.organizationId,
      userId,
      branchId,
      false,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Patch(':userId/merchant')
  @ApiOperation({
    summary: 'Set the tenant-local profile represented by a merchant member',
  })
  @ApiOkResponse({ type: MemberMerchantResponse })
  @ApiConflictResponse({
    description: 'Member is not MERCHANT or membership changed concurrently',
  })
  setMerchant(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateMemberMerchantDto,
  ) {
    return this.membershipsService.setMerchant(
      organization.organizationId,
      userId,
      dto.merchantId,
    );
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
