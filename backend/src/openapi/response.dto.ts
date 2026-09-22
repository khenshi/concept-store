import {
  ApiExtraModels,
  getSchemaPath,
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PickType,
} from '@nestjs/swagger';
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
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) merchantId!:
    string | null;
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

export class InvitationMerchantSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) code!: string | null;
  @ApiProperty({ enum: MerchantStatus }) status!: MerchantStatus;
}

export class InvitationBranchIdentityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) code!: string | null;
}

export class InvitationBranchGrantDto {
  @ApiProperty({ type: InvitationBranchIdentityDto })
  branch!: InvitationBranchIdentityDto;
}

export class OrganizationInvitationResponseDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) merchantId!:
    string | null;
  @ApiProperty({ type: InvitationMerchantSummaryDto, nullable: true })
  merchant!: InvitationMerchantSummaryDto | null;
  @ApiProperty({ type: [InvitationBranchGrantDto] })
  branches!: InvitationBranchGrantDto[];
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
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    description:
      'Per-branch low-stock threshold; zero disables low-stock warnings',
  })
  lowStockThreshold!: number;
  @ApiProperty({ enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] })
  stockStatus!: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
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

export class PosCatalogResponseDto {
  @ApiProperty({ format: 'uuid' }) branchInventoryId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ type: String, example: '850.00', pattern: '^\\d+\\.\\d{2}$' })
  sellingPrice!: string;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 2147483647 })
  quantity!: number;
  @ApiProperty({
    description: 'Current stock is positive; checkout must revalidate',
  })
  eligible!: boolean;
}

export class CompletedSaleItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) branchInventoryId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647 })
  quantity!: number;
  @ApiProperty({ type: String, example: '850.00' }) unitPrice!: string;
  @ApiProperty({ type: String, example: '1700.00' }) lineTotal!: string;
}

export class CompletedSaleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty() receiptCode!: string;
  @ApiProperty({ format: 'date-time' }) completedAt!: Date;
  @ApiProperty() organizationName!: string;
  @ApiProperty() branchName!: string;
  @ApiProperty({ type: String, nullable: true }) branchCode!: string | null;
  @ApiProperty() cashierName!: string;
  @ApiProperty({ enum: ['CASH', 'GCASH', 'CARD'] }) paymentMethod!: string;
  @ApiProperty({ type: String, nullable: true, example: '1000.00' })
  cashTender!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '150.00' })
  cashChange!: string | null;
  @ApiProperty({ type: String, nullable: true }) paymentReference!:
    string | null;
  @ApiProperty({ type: String, example: '850.00' }) total!: string;
  @ApiProperty({ type: [CompletedSaleItemResponseDto] })
  items!: CompletedSaleItemResponseDto[];
}

export class MerchantSaleItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647 })
  quantity!: number;
  @ApiProperty({ type: String }) unitPrice!: string;
  @ApiProperty({ type: String }) lineTotal!: string;
}

export class MerchantSaleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() receiptCode!: string;
  @ApiProperty({ format: 'date-time' }) completedAt!: Date;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty() branchName!: string;
  @ApiProperty({ type: String, nullable: true }) branchCode!: string | null;
  @ApiProperty({ type: [MerchantSaleItemResponseDto] })
  items!: MerchantSaleItemResponseDto[];
  @ApiProperty({
    type: String,
    description: 'Sum of own historical items, never the whole-sale total',
  })
  ownItemsSubtotal!: string;
}

@ApiExtraModels(CompletedSaleResponseDto, MerchantSaleResponseDto)
export class SalesPageResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(CompletedSaleResponseDto) },
        { $ref: getSchemaPath(MerchantSaleResponseDto) },
      ],
    },
  })
  items!: (CompletedSaleResponseDto | MerchantSaleResponseDto)[];
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Count of permitted matching sales only',
  })
  total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalPages!: number;
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
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    description:
      'Per-branch low-stock threshold; zero disables low-stock warnings',
  })
  lowStockThreshold!: number;
  @ApiProperty({ enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] })
  stockStatus!: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: InventoryProductResponseDto })
  product!: InventoryProductResponseDto;
}

export class BranchInventoryPageResponseDto {
  @ApiProperty({ type: BranchInventoryResponseDto, isArray: true })
  items!: BranchInventoryResponseDto[];
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class EligibleProductsPageResponseDto {
  @ApiProperty({ type: ProductResponseDto, isArray: true })
  items!: ProductResponseDto[];
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class InventoryHealthSummaryResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) inStock!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) lowStock!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) outOfStock!: number;
}

export class InventoryReconciliationMismatchResponseDto {
  @ApiProperty({ format: 'uuid' }) inventoryId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0 }) recordedQuantity!: number;
  @ApiProperty({
    type: String,
    description: 'Exact signed sum of all movement deltas',
  })
  ledgerQuantity!: string;
  @ApiProperty({
    type: String,
    description: 'Recorded quantity minus ledger sum',
  })
  difference!: string;
}

export class InventoryReconciliationPageResponseDto {
  @ApiProperty({
    type: InventoryReconciliationMismatchResponseDto,
    isArray: true,
  })
  items!: InventoryReconciliationMismatchResponseDto[];
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  nextCursor!: string | null;
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
    description:
      'Authenticated actor ID for stock-command responses; history responses expose the display name instead',
  })
  createdById!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class BranchIdentityResponseDto extends PickType(BranchResponseDto, [
  'id',
  'name',
  'code',
] as const) {}
export class MerchantIdentityResponseDto extends PickType(MerchantResponseDto, [
  'id',
  'name',
  'code',
  'status',
] as const) {}
export class MerchantMovementResponseDto extends OmitType(
  InventoryMovementResponseDto,
  ['createdById'] as const,
) {}

export class InventoryMovementHistoryResponseDto extends OmitType(
  InventoryMovementResponseDto,
  ['createdById'] as const,
) {
  @ApiProperty({
    description:
      'Display name of the authenticated organization member who performed the movement',
    example: 'Maria Santos',
  })
  actorName!: string;
}

export class MerchantMovementHistoryResponseDto extends OmitType(
  InventoryMovementHistoryResponseDto,
  ['actorName'] as const,
) {}
