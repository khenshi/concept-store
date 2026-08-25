import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SpaceAssignmentsController } from './space-assignments/space-assignments.controller';
import { SpaceAssignmentsService } from './space-assignments/space-assignments.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [SpacesController, SpaceAssignmentsController],
  providers: [SpacesService, SpaceAssignmentsService],
})
export class SpacesModule {}
