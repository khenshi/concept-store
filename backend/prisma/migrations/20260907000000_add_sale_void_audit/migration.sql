CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED');

ALTER TYPE "InventoryMovementType" ADD VALUE 'VOID';

ALTER TABLE "Sale"
ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT,
ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Sale_organizationId_branchId_status_completedAt_idx"
ON "Sale"("organizationId", "branchId", "status", "completedAt");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_void_audit_check" CHECK (
  ("status" = 'COMPLETED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR
  ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(btrim("voidReason")) > 0)
);
