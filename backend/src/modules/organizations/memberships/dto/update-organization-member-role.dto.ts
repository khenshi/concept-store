import { IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateOrganizationMemberRoleDto {
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
