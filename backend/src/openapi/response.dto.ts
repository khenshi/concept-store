import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgreementStatus,
  InventoryMovementType,
  MerchantAccountEntryType,
  MerchantStatus,
  OrganizationRole,
  PaymentMethod,
  ProductStatus,
  PayoutMethod,
  RentCollectionMethod,
  RentDeductionTiming,
  SettlementSchedule,
  SettlementStatus,
  SpaceStatus,
  SpaceType,
} from '../generated/prisma/client';

export class StatusResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;

  @ApiProperty({ example: 'Maria' })
  firstName!: string;

  @ApiProperty({ example: 'Santos' })
  lastName!: string;

  @ApiPropertyOptional({ nullable: true, example: '+63 917 123 4567' })
  phone!: string | null;
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

  @ApiProperty({ example: 'Maria' })
  firstName!: string;

  @ApiProperty({ example: 'Santos' })
  lastName!: string;

  @ApiPropertyOptional({ nullable: true, example: '+63 917 123 4567' })
  phone!: string | null;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: Date;
}

export class OrganizationInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  acceptedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  revokedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
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

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export class AcceptedOrganizationInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'Common Ground Concept Store' })
  organizationName!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;
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

export class MerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'Amihan Goods' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-01' })
  code!: string | null;

  @ApiProperty({ example: 'Maria Santos' })
  contactName!: string;

  @ApiProperty({ format: 'email', example: 'maria@amihan.example' })
  email!: string;

  @ApiProperty({ example: '+63 917 123 4567' })
  phone!: string;

  @ApiProperty({ enum: MerchantStatus })
  status!: MerchantStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({
    type: () => MerchantBranchResponseDto,
    isArray: true,
    minItems: 1,
  })
  branches!: MerchantBranchResponseDto[];
}

export class MerchantBranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Makati Main' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'MKT-01' })
  code!: string | null;
}

export class ProductMerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Amihan Goods' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-01' })
  code!: string | null;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ example: 'Handwoven pouch' })
  name!: string;

  @ApiProperty({ example: 'AMH-01' })
  sku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  barcode!: string | null;

  @ApiProperty({ type: String, example: '450.00' })
  sellingPrice!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: ProductMerchantResponseDto })
  merchant!: ProductMerchantResponseDto;
}

export class PosProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ example: 'Handwoven pouch' })
  name!: string;

  @ApiProperty({ example: 'AMH-01' })
  sku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  barcode!: string | null;

  @ApiProperty({ type: String, example: '450.00' })
  sellingPrice!: string;

  @ApiProperty({ example: 12 })
  quantity!: number;

  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({ type: ProductMerchantResponseDto })
  merchant!: ProductMerchantResponseDto;
}

export class PosProductPageResponseDto {
  @ApiProperty({ type: PosProductResponseDto, isArray: true })
  items!: PosProductResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 30 })
  limit!: number;
}

export class SaleBranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Makati Main' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'MKT-01' })
  code!: string | null;
}

export class SaleCashierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Maria' })
  firstName!: string;

  @ApiProperty({ example: 'Santos' })
  lastName!: string;

  @ApiProperty({ format: 'email' })
  email!: string;
}

export class SaleItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ example: 'Handwoven pouch' })
  productName!: string;

  @ApiProperty({ example: 'AMH-01' })
  productSku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  productBarcode!: string | null;

  @ApiProperty({ example: 'Amihan Goods' })
  merchantName!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ type: String, example: '450.00' })
  unitPrice!: string;

  @ApiProperty({ type: String, example: '900.00' })
  subtotal!: string;

  @ApiProperty({ type: String, example: '0.00' })
  discountAmount!: string;

  @ApiProperty({ type: String, example: '900.00' })
  total!: string;
}

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ type: String, example: '900.00' })
  amount!: string;

  @ApiPropertyOptional({ nullable: true, example: 'GCASH-10425' })
  referenceNumber!: string | null;

  @ApiProperty({ format: 'uuid' })
  confirmedById!: string;

  @ApiProperty({ format: 'date-time' })
  paidAt!: Date;
}

export class SaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  cashierId!: string;

  @ApiProperty({ example: 'S-3380E77A328742F49126BF94C02370BB' })
  saleNumber!: string;

  @ApiProperty({ format: 'uuid' })
  clientTransactionId!: string;

  @ApiProperty({ type: String, example: '900.00' })
  subtotal!: string;

  @ApiProperty({ type: String, example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ type: String, example: '900.00' })
  total!: string;

  @ApiProperty({ format: 'date-time' })
  completedAt!: Date;

  @ApiProperty({ type: SaleBranchResponseDto })
  branch!: SaleBranchResponseDto;

  @ApiProperty({ type: SaleCashierResponseDto })
  cashier!: SaleCashierResponseDto;

  @ApiProperty({ type: SaleItemResponseDto, isArray: true })
  items!: SaleItemResponseDto[];

  @ApiProperty({ type: PaymentResponseDto, isArray: true })
  payments!: PaymentResponseDto[];
}

export class SaleSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  cashierId!: string;

  @ApiProperty({ example: 'S-3380E77A328742F49126BF94C02370BB' })
  saleNumber!: string;

  @ApiProperty({ type: String, example: '900.00' })
  subtotal!: string;

  @ApiProperty({ type: String, example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ type: String, example: '900.00' })
  total!: string;

  @ApiProperty({ example: 2 })
  itemCount!: number;

  @ApiProperty({ enum: PaymentMethod, isArray: true })
  paymentMethods!: PaymentMethod[];

  @ApiProperty({ format: 'date-time' })
  completedAt!: Date;

  @ApiProperty({ type: SaleCashierResponseDto })
  cashier!: SaleCashierResponseDto;
}

export class SalePageResponseDto {
  @ApiProperty({ type: SaleSummaryResponseDto, isArray: true })
  items!: SaleSummaryResponseDto[];

  @ApiProperty({ example: 125 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 30 })
  limit!: number;
}

export class InventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 24 })
  quantity!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class InventoryMovementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 10 })
  quantityChange!: number;

  @ApiProperty({ enum: InventoryMovementType })
  type!: InventoryMovementType;

  @ApiPropertyOptional({ nullable: true, example: 'DELIVERY-1042' })
  referenceId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Opening stock count' })
  note!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class InventoryOperationResponseDto {
  @ApiProperty({ type: InventoryResponseDto })
  inventory!: InventoryResponseDto;

  @ApiProperty({ type: InventoryMovementResponseDto })
  movement!: InventoryMovementResponseDto;
}

export class InventoryBranchSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Makati Main' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'MKT-01' })
  code!: string | null;
}

export class InventoryProductSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ example: 'Handwoven pouch' })
  name!: string;

  @ApiProperty({ example: 'AMH-01' })
  sku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  barcode!: string | null;

  @ApiProperty({ type: String, example: '450.00' })
  sellingPrice!: string;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: ProductMerchantResponseDto })
  merchant!: ProductMerchantResponseDto;
}

export class InventoryViewResponseDto extends InventoryResponseDto {
  @ApiProperty({ type: InventoryProductSummaryResponseDto })
  product!: InventoryProductSummaryResponseDto;

  @ApiProperty({ type: InventoryBranchSummaryResponseDto })
  branch!: InventoryBranchSummaryResponseDto;
}

export class InventoryPageResponseDto {
  @ApiProperty({ type: InventoryViewResponseDto, isArray: true })
  items!: InventoryViewResponseDto[];

  @ApiProperty({ example: 125 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 50 })
  limit!: number;
}

export class InventoryMovementProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Handwoven pouch' })
  name!: string;

  @ApiProperty({ example: 'AMH-01' })
  sku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  barcode!: string | null;
}

export class InventoryMovementActorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'manager@example.com' })
  email!: string;
}

export class InventoryMovementViewResponseDto extends InventoryMovementResponseDto {
  @ApiProperty({ type: InventoryMovementProductResponseDto })
  product!: InventoryMovementProductResponseDto;

  @ApiProperty({ type: InventoryBranchSummaryResponseDto })
  branch!: InventoryBranchSummaryResponseDto;

  @ApiProperty({ type: InventoryMovementActorResponseDto })
  createdBy!: InventoryMovementActorResponseDto;
}

export class InventoryMovementPageResponseDto {
  @ApiProperty({ type: InventoryMovementViewResponseDto, isArray: true })
  items!: InventoryMovementViewResponseDto[];

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  nextCursor!: string | null;
}

export class SpaceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ example: 'RACK-A01' })
  code!: string;

  @ApiProperty({ example: 'Front display rack' })
  name!: string;

  @ApiProperty({ enum: SpaceType })
  type!: SpaceType;

  @ApiPropertyOptional({ nullable: true, example: 'Window bay' })
  customType!: string | null;

  @ApiProperty({ enum: SpaceStatus })
  status!: SpaceStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class SpaceAssignmentMerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Amihan Goods' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-01' })
  code!: string | null;
}

export class SpaceCurrentAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: SpaceAssignmentMerchantResponseDto })
  merchant!: SpaceAssignmentMerchantResponseDto;
}

export class SpaceListResponseDto extends SpaceResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: SpaceCurrentAssignmentResponseDto,
  })
  currentAssignment!: SpaceCurrentAssignmentResponseDto | null;
}

export class SpaceAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  spaceId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ format: 'date', example: '2026-08-25' })
  startDate!: Date;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    example: '2026-09-30',
  })
  endDate!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: SpaceAssignmentMerchantResponseDto })
  merchant!: SpaceAssignmentMerchantResponseDto;
}

export class SpaceAssignmentSpaceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'RACK-A01' })
  code!: string;

  @ApiProperty({ example: 'Front display rack' })
  name!: string;

  @ApiProperty({ enum: SpaceType })
  type!: SpaceType;

  @ApiProperty({ enum: SpaceStatus })
  status!: SpaceStatus;
}

export class BranchSpaceAssignmentResponseDto extends SpaceAssignmentResponseDto {
  @ApiProperty({ type: SpaceAssignmentSpaceResponseDto })
  space!: SpaceAssignmentSpaceResponseDto;
}

export class MerchantAgreementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ format: 'date', example: '2026-09-01' })
  startDate!: Date;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    example: '2027-08-31',
  })
  endDate!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '2500.00' })
  fixedRentAmount!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '5.00' })
  commissionRate!: string | null;

  @ApiProperty({ enum: RentCollectionMethod })
  rentCollectionMethod!: RentCollectionMethod;

  @ApiProperty({ enum: SettlementSchedule })
  settlementSchedule!: SettlementSchedule;

  @ApiProperty({ enum: AgreementStatus })
  status!: AgreementStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class MerchantAgreementMerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Amihan Goods' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-01' })
  code!: string | null;
}

export class MerchantAgreementViewResponseDto extends MerchantAgreementResponseDto {
  @ApiProperty({ type: MerchantAgreementMerchantResponseDto })
  merchant!: MerchantAgreementMerchantResponseDto;
}

export class SettlementMerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Amihan Goods' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'AMIHAN-01' })
  code!: string | null;
}

export class SettlementSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ format: 'date', example: '2026-07-01' })
  periodStart!: Date;

  @ApiProperty({ format: 'date', example: '2026-07-31' })
  periodEnd!: Date;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    example: '2026-08-02',
  })
  scheduledDeadline!: Date | null;

  @ApiProperty({ enum: SettlementSchedule })
  schedule!: SettlementSchedule;

  @ApiProperty({ enum: SettlementStatus })
  status!: SettlementStatus;

  @ApiProperty({ type: String, example: '50000.00' })
  grossSales!: string;

  @ApiProperty({ type: String, example: '1000.00' })
  refundTotal!: string;

  @ApiProperty({ type: String, example: '49000.00' })
  netSales!: string;

  @ApiProperty({ type: String, example: '5000.00' })
  commissionAmount!: string;

  @ApiProperty({ type: String, example: '2000.00' })
  fixedRentAmount!: string;

  @ApiProperty({ type: String, example: '2000.00' })
  rentAccruedAmount!: string;

  @ApiProperty({ type: String, example: '0.00' })
  adjustmentTotal!: string;

  @ApiProperty({ type: String, example: '43000.00' })
  netPayout!: string;

  @ApiProperty({ format: 'uuid' })
  calculatedById!: string;

  @ApiProperty({ format: 'date-time' })
  calculatedAt!: Date;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  approvedById!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  approvedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: SettlementMerchantResponseDto })
  merchant!: SettlementMerchantResponseDto;
}

export class SettlementPageResponseDto {
  @ApiProperty({ type: SettlementSummaryResponseDto, isArray: true })
  items!: SettlementSummaryResponseDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 30 })
  limit!: number;
}

export class SettlementTermResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  agreementId!: string;

  @ApiProperty({ format: 'date' })
  segmentStart!: Date;

  @ApiProperty({ format: 'date' })
  segmentEnd!: Date;

  @ApiProperty({ enum: SettlementSchedule })
  schedule!: SettlementSchedule;

  @ApiProperty({ enum: RentCollectionMethod })
  rentCollectionMethod!: RentCollectionMethod;

  @ApiProperty({ enum: RentDeductionTiming })
  rentDeductionTiming!: RentDeductionTiming;

  @ApiPropertyOptional({ nullable: true, type: String })
  fixedRentRate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  commissionRate!: string | null;

  @ApiProperty({ type: String })
  grossSales!: string;

  @ApiProperty({ type: String })
  commissionAmount!: string;

  @ApiProperty({ type: String })
  fixedRentAmount!: string;

  @ApiProperty({ type: String })
  rentAccruedAmount!: string;
}

export class SettlementSaleSourceResponseDto {
  @ApiProperty({ example: 'Handwoven pouch' })
  productName!: string;

  @ApiProperty({ example: 'AMH-01' })
  productSku!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ type: String, example: '900.00' })
  total!: string;

  @ApiProperty({
    type: 'object',
    properties: {
      saleNumber: { type: 'string' },
      completedAt: { type: 'string', format: 'date-time' },
    },
  })
  sale!: { saleNumber: string; completedAt: Date };
}

export class SettlementSaleItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  saleItemId!: string;

  @ApiProperty({ format: 'uuid' })
  termSnapshotId!: string;

  @ApiProperty({ type: String })
  grossAmount!: string;

  @ApiProperty({ type: SettlementSaleSourceResponseDto })
  saleItem!: SettlementSaleSourceResponseDto;
}

export class MerchantFinanceEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: MerchantAccountEntryType })
  type!: MerchantAccountEntryType;

  @ApiProperty({ type: String, example: '-500.00' })
  amount!: string;

  @ApiProperty({ example: 'Prior balance correction' })
  reason!: string;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: Date;
}

export class MerchantPayoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiProperty({ enum: PayoutMethod })
  method!: PayoutMethod;

  @ApiPropertyOptional({ nullable: true })
  referenceNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  paidAt!: Date;

  @ApiProperty({ format: 'uuid' })
  recordedById!: string;
}

export class SettlementResponseDto extends SettlementSummaryResponseDto {
  @ApiProperty({ type: SettlementTermResponseDto, isArray: true })
  terms!: SettlementTermResponseDto[];

  @ApiProperty({ type: SettlementSaleItemResponseDto, isArray: true })
  saleItems!: SettlementSaleItemResponseDto[];

  @ApiProperty({ type: MerchantFinanceEntryResponseDto, isArray: true })
  financeEntries!: MerchantFinanceEntryResponseDto[];

  @ApiPropertyOptional({ nullable: true, type: MerchantPayoutResponseDto })
  payout!: MerchantPayoutResponseDto | null;
}
