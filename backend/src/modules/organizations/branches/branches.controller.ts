import {
  BranchDirectoryResponseDto,
  BranchDirectoryItemResponseDto,
  BranchDirectorySummaryResponseDto,
  BranchIdentityResponseDto,
} from '../../../openapi/response.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BranchResponseDto } from '../../../openapi/response.dto';
import { OrganizationRole } from '../../../generated/prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { ResourceAccessGuard } from '../authorization/resource-access.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { BranchesService } from './branches.service';
import type { BranchRecord } from './branches.types';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchDirectoryQueryDto } from './dto/list-branch-directory-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateBranchStatusDto } from './dto/update-branch-status.dto';

@UseGuards(AuthGuard, OrganizationAccessGuard, ResourceAccessGuard)
@ApiExtraModels(
  BranchResponseDto,
  BranchIdentityResponseDto,
  BranchDirectoryResponseDto,
  BranchDirectoryItemResponseDto,
  BranchDirectorySummaryResponseDto,
)
@ApiTags('branches')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiNotFoundResponse({ description: 'Organization or branch was not found' })
@Controller('organizations/:organizationId/branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @OrganizationRoles(OrganizationRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Create a branch' })
  @ApiCreatedResponse({ type: BranchResponseDto })
  @ApiForbiddenResponse({
    description: 'The organization role cannot create branches',
  })
  @ApiConflictResponse({
    description: 'The branch name or code already exists',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchRecord> {
    return this.branchesService.create(organization.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List branches in the organization' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(BranchResponseDto) },
          { $ref: getSchemaPath(BranchIdentityResponseDto) },
        ],
      },
    },
  })
  findAll(@CurrentOrganization() organization: OrganizationContext) {
    return this.branchesService.findAll(
      organization.organizationId,
      organization,
    );
  }

  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.MANAGER,
    OrganizationRole.CASHIER,
  )
  @Get('directory')
  @ApiOperation({ summary: 'Page the staff branch directory' })
  @ApiOkResponse({ type: BranchDirectoryResponseDto })
  findDirectory(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListBranchDirectoryQueryDto,
  ) {
    return this.branchesService.findDirectory(organization, query);
  }

  @Get(':branchId')
  @ApiOperation({ summary: 'Get a branch' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BranchResponseDto) },
        { $ref: getSchemaPath(BranchIdentityResponseDto) },
      ],
    },
  })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
  ) {
    return this.branchesService.findOne(
      organization.organizationId,
      branchId,
      organization,
    );
  }

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Patch(':branchId')
  @ApiOperation({ summary: 'Update a branch' })
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiForbiddenResponse({
    description: 'The organization role cannot update branches',
  })
  @ApiConflictResponse({
    description: 'The branch name or code already exists',
  })
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

  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
  @Patch(':branchId/status')
  @ApiOperation({ summary: 'Change a branch lifecycle status' })
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiForbiddenResponse({
    description: 'The organization role cannot change branch status',
  })
  updateStatus(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: UpdateBranchStatusDto,
  ): Promise<BranchRecord> {
    return this.branchesService.updateStatus(
      organization.organizationId,
      branchId,
      organization,
      dto,
    );
  }
}
