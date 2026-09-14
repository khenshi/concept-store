-- Text-based checks avoid using the added enum value before migration commit.
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN';

CREATE UNIQUE INDEX "SaleItem_refund_source_key" ON "SaleItem"("id", "organizationId", "branchId", "saleId", "branchInventoryId", "merchantId", "unitPrice");

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "refundCode" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "createdById" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "paymentMethod" "SalePaymentMethod" NOT NULL,
  "paymentReference" TEXT,
  "total" DECIMAL(24,2) NOT NULL,
  "refundCommand" JSONB NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_total_check" CHECK ("total" > 0 AND "total" <= 9999999999999999999999.99),
  CONSTRAINT "Refund_code_check" CHECK (char_length(btrim("refundCode")) > 0 AND "refundCode" = btrim("refundCode")),
  CONSTRAINT "Refund_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 2 AND 500 AND "reason" = btrim("reason")),
  CONSTRAINT "Refund_command_check" CHECK (jsonb_typeof("refundCommand") = 'object'),
  CONSTRAINT "Refund_payment_check" CHECK (
    ("paymentMethod" = 'CASH' AND "paymentReference" IS NULL)
    OR ("paymentMethod" IN ('GCASH', 'CARD') AND "paymentReference" IS NOT NULL
      AND char_length(btrim("paymentReference")) BETWEEN 2 AND 100 AND "paymentReference" = btrim("paymentReference"))
  )
);
CREATE UNIQUE INDEX "Refund_organizationId_refundCode_key" ON "Refund"("organizationId", "refundCode");
CREATE UNIQUE INDEX "Refund_organizationId_requestId_key" ON "Refund"("organizationId", "requestId");
CREATE UNIQUE INDEX "Refund_sale_scope_key" ON "Refund"("id", "organizationId", "branchId", "saleId");
CREATE INDEX "Refund_sale_history_idx" ON "Refund"("organizationId", "branchId", "saleId", "completedAt", "id");
CREATE INDEX "Refund_branch_reports_idx" ON "Refund"("organizationId", "branchId", "completedAt", "id");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_sale_scope_fkey" FOREIGN KEY ("saleId", "organizationId", "branchId") REFERENCES "Sale"("id", "organizationId", "branchId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RefundItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "branchInventoryId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "restockQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(22,2) NOT NULL,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundItem_quantity_check" CHECK ("quantity" > 0 AND "restockQuantity" >= 0 AND "restockQuantity" <= "quantity"),
  CONSTRAINT "RefundItem_price_check" CHECK ("unitPrice" > 0 AND "unitPrice" <= 9999999999.99),
  CONSTRAINT "RefundItem_total_check" CHECK ("lineTotal" = "unitPrice" * "quantity")
);
CREATE UNIQUE INDEX "RefundItem_refundId_saleItemId_key" ON "RefundItem"("refundId", "saleItemId");
CREATE UNIQUE INDEX "RefundItem_movement_scope_key" ON "RefundItem"("id", "organizationId", "branchId", "branchInventoryId", "restockQuantity");
CREATE INDEX "RefundItem_returned_quantity_idx" ON "RefundItem"("organizationId", "branchId", "saleId", "saleItemId");
CREATE INDEX "RefundItem_merchant_refunds_idx" ON "RefundItem"("organizationId", "merchantId", "branchId", "refundId");
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refund_scope_fkey" FOREIGN KEY ("refundId", "organizationId", "branchId", "saleId") REFERENCES "Refund"("id", "organizationId", "branchId", "saleId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_saleItem_source_fkey" FOREIGN KEY ("saleItemId", "organizationId", "branchId", "saleId", "branchInventoryId", "merchantId", "unitPrice") REFERENCES "SaleItem"("id", "organizationId", "branchId", "saleId", "branchInventoryId", "merchantId", "unitPrice") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement" ADD COLUMN "refundItemId" TEXT;
CREATE UNIQUE INDEX "InventoryMovement_refundItem_scope_key" ON "InventoryMovement"("refundItemId", "organizationId", "branchId", "branchInventoryId", "quantityChange");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_refundItem_scope_fkey" FOREIGN KEY ("refundItemId", "organizationId", "branchId", "branchInventoryId", "quantityChange") REFERENCES "RefundItem"("id", "organizationId", "branchId", "branchInventoryId", "restockQuantity") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_return_check" CHECK (
  ("type"::text = 'RETURN' AND "refundItemId" IS NOT NULL AND "quantityChange" > 0)
  OR ("type"::text <> 'RETURN' AND "refundItemId" IS NULL)
);
