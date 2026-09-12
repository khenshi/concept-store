import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryMovementType,
  MerchantStatus,
  OrganizationRole,
  ProductStatus,
} from '../generated/prisma/client';

export class StatusResponseDto {
  @ApiProperty({ example: 'ok' }) status!: string;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;
  @ApiProperty({ example: 'Maria' }) firstName!: string;
  @ApiProperty({ example: 'Santos' }) lastName!: string;
  @ApiPropertyOptional({ nullable: true, example: '+63 917 123 4567' }) phone!:
    string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token' })
  accessToken!: string;
  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}

export class OrganizationAccessResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Common Ground Concept Store' }) name!: string;
  @ApiProperty({ enum: OrganizationRole }) role!: OrganizationRole;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class OrganizationMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email', example: 'manager@example.com' })
  email!: string;
  @ApiProperty({ example: 'Maria' }) firstName!: string;
  @ApiProperty({ example: 'Santos' }) lastName!: string;
  @ApiPropertyOptional({ nullable: true, example: '+63 917 123 4567' }) phone!:
    string | null;
  @ApiProperty({ enum: OrganizationRole }) role!: OrganizationRole;
  @ApiProperty({ format: 'date-time' }) joinedAt!: Date;
}

export class OrganizationInvitationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: OrganizationRole }) role!: OrganizationRole;
  @ApiProperty({ format: 'date-time' }) expiresAt!: Date;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  acceptedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  revokedAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class CreatedOrganizationInvitationResponseDto {
  @ApiProperty({ type: OrganizationInvitationResponseDto })
  invitation!: OrganizationInvitationResponseDto;
  @ApiProperty({
    description: 'Single-use invitation token returned only once',
  })
  token!: string;
}

export class OrganizationInvitationPreviewResponseDto {
  @ApiProperty({ example: 'Common Ground Concept Store' })
  organizationName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: OrganizationRole }) role!: OrganizationRole;
  @ApiProperty({ format: 'date-time' }) expiresAt!: Date;
}

export class AcceptedOrganizationInvitationResponseDto {
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ example: 'Common Ground Concept Store' })
  organizationName!: string;
  @ApiProperty({ enum: OrganizationRole }) role!: OrganizationRole;
}

export class BranchResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ example: 'Makati Main' }) name!: string;
  @ApiPropertyOptional({ nullable: true, example: 'MKT-01' }) code!:
    string | null;
  @ApiProperty({ example: '123 Retail Street' }) addressLine1!: string;
  @ApiPropertyOptional({ nullable: true }) addressLine2!: string | null;
  @ApiProperty({ example: 'Makati' }) city!: string;
  @ApiProperty({ example: 'Metro Manila' }) province!: string;
  @ApiPropertyOptional({ nullable: true, example: '1200' }) postalCode!:
    string | null;
  @ApiProperty({ minLength: 2, maxLength: 2, example: 'PH' })
  countryCode!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class MerchantResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ example: 'Amihan Home Studio' }) name!: string;
  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-HOME' }) code!:
    string | null;
  @ApiProperty({ example: 'Mara Santos' }) contactName!: string;
  @ApiPropertyOptional({ nullable: true, format: 'email' }) email!:
    string | null;
  @ApiProperty({ example: '+63 917 555 0101' }) phone!: string;
  @ApiProperty({ enum: MerchantStatus }) status!: MerchantStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty({ example: 'Amihan Ceramic Vase' }) name!: string;
  @ApiProperty({ type: String, nullable: true, example: 'AMIHAN-VASE' }) sku!:
    string | null;
  @ApiProperty({ type: String, nullable: true, example: '0001234567890' })
  barcode!: string | null;
  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class InventoryBranchResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Makati Main' }) name!: string;
  @ApiProperty({ type: String, nullable: true, example: 'MAKATI' }) code!:
    string | null;
}

export class ProductInventoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({
    type: String,
    example: '925.50',
    pattern: '^\\d+\\.\\d{2}$',
    description: 'PHP selling price as an exact two-decimal string',
  })
  sellingPrice!: string;
  @ApiProperty({ minimum: 0, maximum: 2147483647, type: 'integer' })
  quantity!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: InventoryBranchResponseDto })
  branch!: InventoryBranchResponseDto;
}

export class InventoryMerchantResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: MerchantStatus }) status!: MerchantStatus;
}

export class InventoryProductResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus;
  @ApiProperty({ type: InventoryMerchantResponseDto })
  merchant!: InventoryMerchantResponseDto;
}

export class BranchInventoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({
    type: String,
    example: '925.50',
    pattern: '^\\d+\\.\\d{2}$',
    description: 'Exact PHP price with two decimal places',
  })
  sellingPrice!: string;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 2147483647 })
  quantity!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: InventoryProductResponseDto })
  product!: InventoryProductResponseDto;
}

export class InventoryMovementResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ format: 'uuid' }) branchInventoryId!: string;
  @ApiProperty({ enum: InventoryMovementType }) type!: InventoryMovementType;
  @ApiProperty({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    description: 'Nonzero signed stock change',
  })
  quantityChange!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 2147483647 })
  quantityAfter!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'Actor ID; no personal data is returned',
  })
  createdById!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
