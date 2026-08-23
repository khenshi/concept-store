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
@Controller('organizations/:organizationId/members')
export class OrganizationMembershipsController {
  constructor(
    private readonly membershipsService: OrganizationMembershipsService,
  ) {}

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Get()
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
  ): Promise<OrganizationMember[]> {
    return this.membershipsService.findAll(organization.organizationId);
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Post()
  add(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    return this.membershipsService.add(organization.organizationId, dto);
  }

  @OrganizationRoles(OrganizationRole.OWNER)
  @Patch(':userId/role')
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
  remove(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.membershipsService.remove(organization.organizationId, userId);
  }
}
