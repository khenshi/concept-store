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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  SpaceStatus,
  SpaceReleaseReason,
} from '../../../generated/prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  AssignSpaceDto,
  CreateSpaceDto,
  CreateSpaceTypeDto,
  ListSpaceTypesDto,
  ListOccupanciesDto,
  ListSpacesDto,
  ReleaseSpaceDto,
  SpaceStatusDto,
  UpdateSpaceTypeDto,
  UpdateSpaceDto,
} from './dto/space.dto';
import { SpacesService } from './spaces.service';

export class SpaceTypeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() archived!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
class SpaceIdentityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ enum: SpaceStatus }) status!: SpaceStatus;
}
class OccupancyIdentityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) code!: string | null;
}
class OccupancyActorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}
export class SpaceOccupancyResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ format: 'uuid' }) spaceId!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startedAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: Date | null;
  @ApiProperty({ enum: SpaceReleaseReason, nullable: true })
  releaseReason!: SpaceReleaseReason | null;
  @ApiProperty({ type: OccupancyActorDto, nullable: true })
  releasedBy!: OccupancyActorDto | null;
  @ApiProperty({ type: SpaceIdentityDto }) space!: SpaceIdentityDto;
  @ApiProperty({ type: OccupancyIdentityDto }) branch!: OccupancyIdentityDto;
  @ApiProperty({ type: OccupancyIdentityDto }) merchant!: OccupancyIdentityDto;
}
export class MerchantSpaceOccupancyResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ format: 'uuid' }) spaceId!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startedAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: Date | null;
  @ApiProperty({ enum: SpaceReleaseReason, nullable: true })
  releaseReason!: SpaceReleaseReason | null;
  @ApiProperty({ type: SpaceIdentityDto }) space!: SpaceIdentityDto;
  @ApiProperty({ type: OccupancyIdentityDto }) branch!: OccupancyIdentityDto;
  @ApiProperty({ type: OccupancyIdentityDto }) merchant!: OccupancyIdentityDto;
}
export class SpaceResponseDto extends SpaceIdentityDto {
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
class SpaceListItemDto extends SpaceResponseDto {
  @ApiProperty({ type: SpaceOccupancyResponseDto, nullable: true })
  currentOccupancy!: SpaceOccupancyResponseDto | null;
}
class MerchantSpaceListItemDto extends SpaceResponseDto {
  @ApiProperty({ type: MerchantSpaceOccupancyResponseDto, nullable: true })
  currentOccupancy!: MerchantSpaceOccupancyResponseDto | null;
}
class PageDto {
  @ApiProperty() page!: number;
  @ApiProperty({ enum: [15] }) limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNext!: boolean;
}
export class SpacePageDto extends PageDto {
  @ApiProperty({ type: [SpaceListItemDto] }) items!: SpaceListItemDto[];
}
export class MerchantSpacePageDto extends PageDto {
  @ApiProperty({ type: [MerchantSpaceListItemDto] })
  items!: MerchantSpaceListItemDto[];
}
export class OccupancyPageDto extends PageDto {
  @ApiProperty({ type: [SpaceOccupancyResponseDto] })
  items!: SpaceOccupancyResponseDto[];
}
export class MerchantOccupancyPageDto extends PageDto {
  @ApiProperty({ type: [MerchantSpaceOccupancyResponseDto] })
  items!: MerchantSpaceOccupancyResponseDto[];
}
const uuid = () => new ParseUUIDPipe({ version: '4' });
@Controller('organizations/:organizationId')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles('OWNER', 'MANAGER', 'MERCHANT')
@ApiTags('spaces')
@ApiBearerAuth('access-token')
@ApiExtraModels(
  SpacePageDto,
  MerchantSpacePageDto,
  OccupancyPageDto,
  MerchantOccupancyPageDto,
)
@ApiBadRequestResponse({ description: 'Invalid command, timestamp, or query' })
@ApiForbiddenResponse({
  description: 'Current role cannot perform this action',
})
@ApiNotFoundResponse({ description: 'Object is absent or inaccessible' })
@ApiConflictResponse({
  description:
    'Occupied, overlapping, inactive, duplicate, or concurrently changed space',
})
export class SpacesController {
  constructor(private readonly service: SpacesService) {}
  @Get('space-types')
  @ApiOperation({
    summary:
      'List shared organization space types; merchants see only types used by their own accessible spaces',
  })
  @ApiOkResponse({ type: [SpaceTypeResponseDto] })
  types(
    @CurrentOrganization() c: OrganizationContext,
    @Query() q: ListSpaceTypesDto,
  ) {
    return this.service.listTypes(c, q);
  }
  @Post('space-types')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Create an organization space type' })
  @ApiCreatedResponse({ type: SpaceTypeResponseDto })
  createType(
    @CurrentOrganization() c: OrganizationContext,
    @Body() dto: CreateSpaceTypeDto,
  ) {
    return this.service.createType(c, dto);
  }
  @Patch('space-types/:typeId')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Rename, archive, or reactivate a space type' })
  @ApiOkResponse({ type: SpaceTypeResponseDto })
  updateType(
    @CurrentOrganization() c: OrganizationContext,
    @Param('typeId', uuid()) id: string,
    @Body() dto: UpdateSpaceTypeDto,
  ) {
    return this.service.updateType(c, id, dto);
  }

  @Get('branches/:branchId/spaces')
  @ApiOperation({
    summary:
      'List accessible branch spaces; merchants receive only their own spaces',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SpacePageDto) },
        { $ref: getSchemaPath(MerchantSpacePageDto) },
      ],
    },
  })
  list(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Query() q: ListSpacesDto,
  ) {
    return this.service.list(c, branch, q);
  }
  @Post('branches/:branchId/spaces')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Create a named branch space' })
  @ApiCreatedResponse({ type: SpaceResponseDto })
  create(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.service.create(c, branch, dto);
  }
  @Get('branches/:branchId/spaces/:spaceId')
  @ApiOperation({ summary: 'Read an accessible space' })
  @ApiOkResponse({ type: SpaceResponseDto })
  read(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
  ) {
    return this.service.findOne(c, branch, id);
  }
  @Patch('branches/:branchId/spaces/:spaceId')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Edit space name or type' })
  @ApiOkResponse({ type: SpaceResponseDto })
  update(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.service.update(c, branch, id, dto);
  }
  @Patch('branches/:branchId/spaces/:spaceId/status')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Archive a free space or reactivate it' })
  @ApiOkResponse({ type: SpaceResponseDto })
  status(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
    @Body() dto: SpaceStatusDto,
  ) {
    return this.service.update(c, branch, id, dto);
  }
  @Get('branches/:branchId/spaces/:spaceId/occupancies')
  @ApiOperation({
    summary:
      'Read current or historical occupancy; merchants receive only their own',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OccupancyPageDto) },
        { $ref: getSchemaPath(MerchantOccupancyPageDto) },
      ],
    },
  })
  history(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
    @Query() q: ListOccupanciesDto,
  ) {
    return this.service.occupancies(c, 'space', id, q, branch);
  }
  @Post('branches/:branchId/spaces/:spaceId/occupancies')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Assign occupancy now or record a past interval' })
  @ApiCreatedResponse({ type: SpaceOccupancyResponseDto })
  assign(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
    @Body() dto: AssignSpaceDto,
  ) {
    return this.service.assign(c, branch, id, dto);
  }
  @Patch('branches/:branchId/spaces/:spaceId/occupancies/:occupancyId/release')
  @OrganizationRoles('OWNER')
  @ApiOperation({ summary: 'Release an open occupancy, preserving history' })
  @ApiOkResponse({ type: SpaceOccupancyResponseDto })
  release(
    @CurrentOrganization() c: OrganizationContext,
    @Param('branchId', uuid()) branch: string,
    @Param('spaceId', uuid()) id: string,
    @Param('occupancyId', uuid()) occupancy: string,
    @Body() dto: ReleaseSpaceDto,
  ) {
    return this.service.release(c, branch, id, occupancy, dto);
  }
  @Get('merchants/:merchantId/spaces')
  @ApiOperation({
    summary: 'Read merchant occupancy across accessible affiliated branches',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OccupancyPageDto) },
        { $ref: getSchemaPath(MerchantOccupancyPageDto) },
      ],
    },
  })
  merchant(
    @CurrentOrganization() c: OrganizationContext,
    @Param('merchantId', uuid()) id: string,
    @Query() q: ListOccupanciesDto,
  ) {
    return this.service.occupancies(c, 'merchant', id, q);
  }
}
