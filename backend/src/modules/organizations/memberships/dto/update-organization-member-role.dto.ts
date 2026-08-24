import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '../../../../generated/prisma/client';

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.CASHIER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
