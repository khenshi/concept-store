import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import type { OrganizationAccess } from './organizations.types';
import { OrganizationsService } from './organizations.service';

@UseGuards(AuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationAccess[]> {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':organizationId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ): Promise<OrganizationAccess> {
    return this.organizationsService.findOneForUser(user.id, organizationId);
  }
}
