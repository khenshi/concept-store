-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "clientTransactionId" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Sale_saleNumber_check" CHECK (char_length("saleNumber") BETWEEN 1 AND 50),
    CONSTRAINT "Sale_clientTransactionId_check" CHECK (char_length("clientTransactionId") BETWEEN 1 AND 100),
    CONSTRAINT "Sale_subtotal_check" CHECK ("subtotal" >= 0),
    CONSTRAINT "Sale_discountTotal_check" CHECK ("discountTotal" >= 0 AND "discountTotal" <= "subtotal"),
    CONSTRAINT "Sale_total_check" CHECK ("total" = "subtotal" - "discountTotal")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "productBarcode" TEXT,
    "merchantName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleItem_productName_check" CHECK (char_length("productName") BETWEEN 1 AND 160),
    CONSTRAINT "SaleItem_productSku_check" CHECK (char_length("productSku") BETWEEN 1 AND 32),
    CONSTRAINT "SaleItem_productBarcode_check" CHECK ("productBarcode" IS NULL OR char_length("productBarcode") BETWEEN 1 AND 64),
    CONSTRAINT "SaleItem_merchantName_check" CHECK (char_length("merchantName") BETWEEN 1 AND 120),
    CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "SaleItem_unitPrice_check" CHECK ("unitPrice" > 0),
    CONSTRAINT "SaleItem_subtotal_check" CHECK ("subtotal" = "unitPrice" * "quantity"),
    CONSTRAINT "SaleItem_discountAmount_check" CHECK ("discountAmount" >= 0 AND "discountAmount" <= "subtotal"),
    CONSTRAINT "SaleItem_total_check" CHECK ("total" = "subtotal" - "discountAmount")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceNumber" TEXT,
    "confirmedById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "Payment_referenceNumber_check" CHECK ("referenceNumber" IS NULL OR char_length("referenceNumber") BETWEEN 1 AND 120)
);

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "saleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_id_organizationId_key" ON "Sale"("id", "organizationId");
CREATE UNIQUE INDEX "Sale_organizationId_saleNumber_key" ON "Sale"("organizationId", "saleNumber");
CREATE UNIQUE INDEX "Sale_organizationId_clientTransactionId_key" ON "Sale"("organizationId", "clientTransactionId");
CREATE INDEX "Sale_organizationId_branchId_completedAt_idx" ON "Sale"("organizationId", "branchId", "completedAt");
CREATE INDEX "Sale_organizationId_cashierId_completedAt_idx" ON "Sale"("organizationId", "cashierId", "completedAt");
CREATE INDEX "SaleItem_organizationId_merchantId_saleId_idx" ON "SaleItem"("organizationId", "merchantId", "saleId");
CREATE INDEX "SaleItem_organizationId_productId_saleId_idx" ON "SaleItem"("organizationId", "productId", "saleId");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "Payment_organizationId_method_paidAt_idx" ON "Payment"("organizationId", "method", "paidAt");
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX "Payment_confirmedById_paidAt_idx" ON "Payment"("confirmedById", "paidAt");
CREATE INDEX "InventoryMovement_saleId_idx" ON "InventoryMovement"("saleId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_organizationId_fkey" FOREIGN KEY ("saleId", "organizationId") REFERENCES "Sale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_organizationId_fkey" FOREIGN KEY ("saleId", "organizationId") REFERENCES "Sale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleId_organizationId_fkey" FOREIGN KEY ("saleId", "organizationId") REFERENCES "Sale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
