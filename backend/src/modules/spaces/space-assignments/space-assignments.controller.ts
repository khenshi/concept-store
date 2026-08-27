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
  ApiBadRequestResponse,
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
import { OrganizationRole } from '../../../generated/prisma/client';
import {
  BranchSpaceAssignmentResponseDto,
  SpaceAssignmentResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../../organizations/authorization/organization-roles.decorator';
import { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import { EndSpaceAssignmentDto } from './dto/end-space-assignment.dto';
import { SpaceAssignmentsService } from './space-assignments.service';
import type {
  BranchSpaceAssignmentRecord,
  SpaceAssignmentRecord,
} from './space-assignments.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('space assignments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage space assignments',
})
@ApiNotFoundResponse({
  description:
    'Organization, space, assignment, or branch merchant was not found',
})
@Controller('organizations/:organizationId')
export class SpaceAssignmentsController {
  constructor(
    private readonly spaceAssignmentsService: SpaceAssignmentsService,
  ) {}

  @Post('spaces/:spaceId/assignments')
  @ApiOperation({ summary: 'Assign a branch merchant to a physical space' })
  @ApiCreatedResponse({ type: SpaceAssignmentResponseDto })
  @ApiConflictResponse({
    description: 'The space is inactive or already has a current assignment',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
    @Body() dto: CreateSpaceAssignmentDto,
  ): Promise<SpaceAssignmentRecord> {
    return this.spaceAssignmentsService.create(
      organization.organizationId,
      spaceId,
      dto,
    );
  }

  @Get('spaces/:spaceId/assignments')
  @ApiOperation({ summary: 'List current and historical space assignments' })
  @ApiOkResponse({ type: SpaceAssignmentResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
  ): Promise<SpaceAssignmentRecord[]> {
    return this.spaceAssignmentsService.findAll(
      organization.organizationId,
      spaceId,
    );
  }

  @Get('branches/:branchId/space-assignments')
  @ApiOperation({
    summary: 'List current and historical assignments for a branch',
  })
  @ApiOkResponse({ type: BranchSpaceAssignmentResponseDto, isArray: true })
  findAllForBranch(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
  ): Promise<BranchSpaceAssignmentRecord[]> {
    return this.spaceAssignmentsService.findAllForBranch(
      organization.organizationId,
      branchId,
    );
  }

  @Patch('space-assignments/:assignmentId/end')
  @ApiOperation({ summary: 'End a current space assignment' })
  @ApiOkResponse({ type: SpaceAssignmentResponseDto })
  @ApiBadRequestResponse({
    description: 'The end date is invalid or precedes the start date',
  })
  @ApiConflictResponse({ description: 'The assignment has already ended' })
  end(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('assignmentId', new ParseUUIDPipe({ version: '4' }))
    assignmentId: string,
    @Body() dto: EndSpaceAssignmentDto,
  ): Promise<SpaceAssignmentRecord> {
    return this.spaceAssignmentsService.end(
      organization.organizationId,
      assignmentId,
      dto,
    );
  }
}
