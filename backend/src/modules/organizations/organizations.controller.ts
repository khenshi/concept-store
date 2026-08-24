import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationAccessResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import type { OrganizationAccess } from './organizations.types';
import { OrganizationsService } from './organizations.service';

@UseGuards(AuthGuard)
@ApiTags('organizations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization owned by the current user' })
  @ApiCreatedResponse({ type: OrganizationAccessResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations available to the current user' })
  @ApiOkResponse({ type: OrganizationAccessResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationAccess[]> {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':organizationId')
  @ApiOperation({
    summary: 'Get an organization available to the current user',
  })
  @ApiOkResponse({ type: OrganizationAccessResponseDto })
  @ApiNotFoundResponse({
    description: 'Organization is unavailable to the user',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.findOneForUser(user.id, organizationId);
  }
}
