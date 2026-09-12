-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchInventory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BranchInventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BranchInventory_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "BranchInventory_sellingPrice_check" CHECK (
        "sellingPrice" > 0 AND "sellingPrice" <= 9999999999.99
    )
);

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchInventoryId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryMovement_quantityChange_check" CHECK ("quantityChange" <> 0),
    CONSTRAINT "InventoryMovement_receipt_check" CHECK (
        "type" <> 'RECEIPT' OR "quantityChange" > 0
    ),
    CONSTRAINT "InventoryMovement_quantityAfter_check" CHECK ("quantityAfter" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_organizationId_key" ON "Branch"("id", "organizationId");
CREATE INDEX "Product_organizationId_merchantId_status_idx" ON "Product"("organizationId", "merchantId", "status");
CREATE INDEX "Product_organizationId_name_idx" ON "Product"("organizationId", "name");
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");
CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");
CREATE INDEX "BranchInventory_organizationId_productId_idx" ON "BranchInventory"("organizationId", "productId");
CREATE UNIQUE INDEX "BranchInventory_organizationId_branchId_productId_key" ON "BranchInventory"("organizationId", "branchId", "productId");
CREATE UNIQUE INDEX "BranchInventory_id_organizationId_branchId_key" ON "BranchInventory"("id", "organizationId", "branchId");
CREATE INDEX "InventoryMovement_history_idx" ON "InventoryMovement"("organizationId", "branchId", "branchInventoryId", "createdAt", "id");
CREATE UNIQUE INDEX "InventoryMovement_organizationId_requestId_key" ON "InventoryMovement"("organizationId", "requestId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchInventory" ADD CONSTRAINT "BranchInventory_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchInventory" ADD CONSTRAINT "BranchInventory_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchInventoryId_organizationId_branchI_fkey" FOREIGN KEY ("branchInventoryId", "organizationId", "branchId") REFERENCES "BranchInventory"("id", "organizationId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
