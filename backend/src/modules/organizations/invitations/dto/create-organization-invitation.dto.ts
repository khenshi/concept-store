import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    type: [String],
    maxItems: 100,
    description: 'Distinct branch UUID v4 identifiers',
  })
  @ValidateIf(
    (dto: CreateOrganizationInvitationDto) => dto.branchIds !== undefined,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required only for MERCHANT invitations',
  })
  @ValidateIf(
    (dto: CreateOrganizationInvitationDto) =>
      dto.role === OrganizationRole.MERCHANT || dto.merchantId !== undefined,
  )
  @IsUUID('4')
  merchantId?: string;
}
