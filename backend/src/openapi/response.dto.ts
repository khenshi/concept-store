import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole } from '../generated/prisma/client';

export class StatusResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token' })
  accessToken!: string;

  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}

export class OrganizationAccessResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Common Ground Concept Store' })
  name!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class OrganizationMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'manager@example.com' })
  email!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: Date;
}

export class BranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'Makati Main' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'MKT-01' })
  code!: string | null;

  @ApiProperty({ example: '123 Retail Street' })
  addressLine1!: string;

  @ApiPropertyOptional({ nullable: true })
  addressLine2!: string | null;

  @ApiProperty({ example: 'Makati' })
  city!: string;

  @ApiProperty({ example: 'Metro Manila' })
  province!: string;

  @ApiPropertyOptional({ nullable: true, example: '1200' })
  postalCode!: string | null;

  @ApiProperty({ minLength: 2, maxLength: 2, example: 'PH' })
  countryCode!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
