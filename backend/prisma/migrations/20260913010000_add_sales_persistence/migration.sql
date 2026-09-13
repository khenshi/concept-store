-- Text-based checks below avoid consuming the new enum value before migration commit.
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE';
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'GCASH', 'CARD');

CREATE UNIQUE INDEX "Product_id_organizationId_merchantId_key" ON "Product"("id", "organizationId", "merchantId");
CREATE UNIQUE INDEX "BranchInventory_id_organizationId_branchId_productId_key" ON "BranchInventory"("id", "organizationId", "branchId", "productId");

CREATE TABLE "Sale" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "receiptCode" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "paymentMethod" "SalePaymentMethod" NOT NULL,
  "cashTender" DECIMAL(24,2),
  "cashChange" DECIMAL(24,2),
  "paymentReference" TEXT,
  "total" DECIMAL(24,2) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationName" TEXT NOT NULL,
  "branchName" TEXT NOT NULL,
  "branchCode" TEXT,
  "cashierName" TEXT NOT NULL,
  "checkoutCommand" JSONB NOT NULL,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sale_total_check" CHECK ("total" > 0 AND "total" <= 9999999999999999999999.99),
  CONSTRAINT "Sale_receiptCode_check" CHECK (char_length(btrim("receiptCode")) > 0),
  CONSTRAINT "Sale_command_check" CHECK (jsonb_typeof("checkoutCommand") = 'object'),
  CONSTRAINT "Sale_payment_check" CHECK (
    ("paymentMethod" = 'CASH' AND "paymentReference" IS NULL
      AND "cashTender" IS NOT NULL AND "cashChange" IS NOT NULL
      AND "cashTender" >= "total" AND "cashTender" <= 9999999999999999999999.99
      AND "cashChange" = "cashTender" - "total")
    OR ("paymentMethod" IN ('GCASH', 'CARD') AND "cashTender" IS NULL
      AND "cashChange" IS NULL AND "paymentReference" IS NOT NULL
      AND char_length(btrim("paymentReference")) BETWEEN 2 AND 100
      AND "paymentReference" = btrim("paymentReference"))
  )
);
CREATE UNIQUE INDEX "Sale_organizationId_receiptCode_key" ON "Sale"("organizationId", "receiptCode");
CREATE UNIQUE INDEX "Sale_organizationId_requestId_key" ON "Sale"("organizationId", "requestId");
CREATE UNIQUE INDEX "Sale_id_organizationId_branchId_key" ON "Sale"("id", "organizationId", "branchId");
CREATE INDEX "Sale_branch_history_idx" ON "Sale"("organizationId", "branchId", "completedAt", "id");
CREATE INDEX "Sale_cashier_history_idx" ON "Sale"("organizationId", "branchId", "createdById", "completedAt", "id");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SaleItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "branchInventoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "merchantName" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(22,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "SaleItem_price_check" CHECK ("unitPrice" > 0 AND "unitPrice" <= 9999999999.99),
  CONSTRAINT "SaleItem_lineTotal_check" CHECK ("lineTotal" = "unitPrice" * "quantity")
);
CREATE UNIQUE INDEX "SaleItem_saleId_branchInventoryId_key" ON "SaleItem"("saleId", "branchInventoryId");
CREATE UNIQUE INDEX "SaleItem_inventory_scope_key" ON "SaleItem"("id", "organizationId", "branchId", "branchInventoryId");
CREATE INDEX "SaleItem_merchant_sales_idx" ON "SaleItem"("organizationId", "merchantId", "branchId", "saleId");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_sale_scope_fkey" FOREIGN KEY ("saleId", "organizationId", "branchId") REFERENCES "Sale"("id", "organizationId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_inventory_scope_fkey" FOREIGN KEY ("branchInventoryId", "organizationId", "branchId", "productId") REFERENCES "BranchInventory"("id", "organizationId", "branchId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_product_merchant_scope_fkey" FOREIGN KEY ("productId", "organizationId", "merchantId") REFERENCES "Product"("id", "organizationId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_merchant_scope_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement" ADD COLUMN "saleItemId" TEXT;
CREATE UNIQUE INDEX "InventoryMovement_saleItem_scope_key" ON "InventoryMovement"("saleItemId", "organizationId", "branchId", "branchInventoryId");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleItem_scope_fkey" FOREIGN KEY ("saleItemId", "organizationId", "branchId", "branchInventoryId") REFERENCES "SaleItem"("id", "organizationId", "branchId", "branchInventoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Compare as text so PostgreSQL does not use the newly added enum value before commit.
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sale_check" CHECK (
  ("type"::text = 'SALE' AND "saleItemId" IS NOT NULL AND "quantityChange" < 0)
  OR ("type"::text <> 'SALE' AND "saleItemId" IS NULL)
);
