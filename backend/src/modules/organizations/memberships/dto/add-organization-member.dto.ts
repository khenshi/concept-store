import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '../../../../generated/prisma/client';

export class AddOrganizationMemberDto {
  @ApiProperty({
    format: 'email',
    example: 'manager@example.com',
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.MANAGER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
