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
import { OrganizationRole } from '../../../generated/prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { BranchesService } from './branches.service';
import type { BranchRecord } from './branches.types';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@Controller('organizations/:organizationId/branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Post()
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchRecord> {
    return this.branchesService.create(organization.organizationId, dto);
  }

  @Get()
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
  ): Promise<BranchRecord[]> {
    return this.branchesService.findAll(organization.organizationId);
  }

  @Get(':branchId')
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
  ): Promise<BranchRecord> {
    return this.branchesService.findOne(organization.organizationId, branchId);
  }

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Patch(':branchId')
  update(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchRecord> {
    return this.branchesService.update(
      organization.organizationId,
      branchId,
      dto,
    );
  }
}
