import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { AllowInactiveReplay } from '../authorization/allow-inactive-replay.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CommandRecoveryService } from './command-recovery.service';
import {
  CommandRecoveryQueryDto,
  CommandRecoveryResponseDto,
  PrepareCommandRecoveryDto,
} from './dto/command-recovery.dto';

@Controller('organizations/:organizationId/command-recovery')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles('OWNER', 'MANAGER', 'CASHIER')
@ApiTags('command-recovery')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({
  description: 'Current role cannot recover this command',
})
@ApiNotFoundResponse({
  description: 'Recovery command or authorized scope not found',
})
@ApiConflictResponse({
  description: 'A command is blocked or its outcome is unresolved',
})
export class CommandRecoveryController {
  constructor(private readonly recovery: CommandRecoveryService) {}

  @Post()
  @ApiOperation({ summary: 'Prepare and freeze a checkout or refund command' })
  @ApiOkResponse({ type: CommandRecoveryResponseDto })
  prepare(
    @CurrentOrganization() context: OrganizationContext,
    @Body() input: PrepareCommandRecoveryDto,
  ) {
    return this.recovery.prepare(context, input);
  }

  @Get()
  @ApiOperation({ summary: 'List the current actor recovery blockers' })
  @ApiOkResponse({ type: [CommandRecoveryResponseDto] })
  list(
    @CurrentOrganization() context: OrganizationContext,
    @Query() query: CommandRecoveryQueryDto,
  ) {
    return this.recovery.list(context, query.kind);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one frozen command and saved outcome' })
  @ApiOkResponse({ type: CommandRecoveryResponseDto })
  get(
    @CurrentOrganization() context: OrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recovery.get(context, id.toLowerCase());
  }

  @Post(':id/submit')
  @AllowInactiveReplay()
  @ApiOperation({ summary: 'Explicitly submit or retry the unchanged command' })
  @ApiOkResponse({ type: CommandRecoveryResponseDto })
  submit(
    @CurrentOrganization() context: OrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recovery.submit(context, id.toLowerCase());
  }

  @Post(':id/acknowledge')
  @AllowInactiveReplay()
  @ApiOperation({
    summary: 'Acknowledge a saved outcome and release its blocker',
  })
  @ApiOkResponse({ type: CommandRecoveryResponseDto })
  acknowledge(
    @CurrentOrganization() context: OrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recovery.acknowledge(context, id.toLowerCase());
  }

  @Post(':id/abandon')
  @ApiOperation({
    summary: 'Safely abandon a prepared, never-submitted command',
  })
  @ApiOkResponse({ type: CommandRecoveryResponseDto })
  abandon(
    @CurrentOrganization() context: OrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recovery.abandon(context, id.toLowerCase());
  }
}
