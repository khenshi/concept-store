import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole } from '../../../../generated/prisma/client';

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.CASHIER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required only when role is MERCHANT',
  })
  @ValidateIf(
    (dto: UpdateOrganizationMemberRoleDto) =>
      dto.role === OrganizationRole.MERCHANT || dto.merchantId !== undefined,
  )
  @IsUUID('4')
  merchantId?: string;
}
