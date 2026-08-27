import { Transform } from 'class-transformer';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '../../../../generated/prisma/client';

export class CreateOrganizationInvitationDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    enum: [
      OrganizationRole.MANAGER,
      OrganizationRole.CASHIER,
      OrganizationRole.MERCHANT,
    ],
  })
  @IsIn([
    OrganizationRole.MANAGER,
    OrganizationRole.CASHIER,
    OrganizationRole.MERCHANT,
  ])
  role!: OrganizationRole;
}
