import { IsEnum } from 'class-validator';
import { OrganizationRole } from '../../../../generated/prisma/client';

export class UpdateOrganizationMemberRoleDto {
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
