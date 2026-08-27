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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import {
  SpaceListResponseDto,
  SpaceResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpacesService } from './spaces.service';
import type { SpaceListRecord, SpaceRecord } from './spaces.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('spaces')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot access space management',
})
@ApiNotFoundResponse({
  description: 'Organization, branch, or space was not found',
})
@Controller('organizations/:organizationId')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Post('branches/:branchId/spaces')
  @ApiOperation({ summary: 'Create a physical space in a branch' })
  @ApiCreatedResponse({ type: SpaceResponseDto })
  @ApiConflictResponse({
    description: 'The space code already exists in the branch',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: CreateSpaceDto,
  ): Promise<SpaceRecord> {
    return this.spacesService.create(
      organization.organizationId,
      branchId,
      dto,
    );
  }

  @Get('branches/:branchId/spaces')
  @ApiOperation({ summary: 'List physical spaces in a branch' })
  @ApiOkResponse({ type: SpaceListResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
  ): Promise<SpaceListRecord[]> {
    return this.spacesService.findAll(organization.organizationId, branchId);
  }

  @Get('spaces/:spaceId')
  @ApiOperation({ summary: 'Get a physical space in the organization' })
  @ApiOkResponse({ type: SpaceResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
  ): Promise<SpaceRecord> {
    return this.spacesService.findOne(organization.organizationId, spaceId);
  }

  @Patch('spaces/:spaceId')
  @ApiOperation({ summary: 'Update a physical space' })
  @ApiOkResponse({ type: SpaceResponseDto })
  @ApiConflictResponse({
    description: 'The space code already exists in the branch',
  })
  update(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceRecord> {
    return this.spacesService.update(organization.organizationId, spaceId, dto);
  }
}
