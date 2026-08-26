-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_IN', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_sellingPrice_check" CHECK ("sellingPrice" > 0)
);

-- CreateTable
CREATE TABLE "Inventory" (
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("productId", "branchId", "organizationId")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryMovement_quantityChange_check" CHECK ("quantityChange" <> 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");
CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");
CREATE INDEX "Product_organizationId_merchantId_status_idx" ON "Product"("organizationId", "merchantId", "status");
CREATE INDEX "Product_organizationId_name_idx" ON "Product"("organizationId", "name");
CREATE INDEX "Inventory_organizationId_branchId_quantity_idx" ON "Inventory"("organizationId", "branchId", "quantity");
CREATE INDEX "Inventory_organizationId_productId_idx" ON "Inventory"("organizationId", "productId");
CREATE INDEX "InventoryMovement_organizationId_branchId_createdAt_idx" ON "InventoryMovement"("organizationId", "branchId", "createdAt");
CREATE INDEX "InventoryMovement_organizationId_productId_createdAt_idx" ON "InventoryMovement"("organizationId", "productId", "createdAt");
CREATE INDEX "InventoryMovement_createdById_createdAt_idx" ON "InventoryMovement"("createdById", "createdAt");
CREATE INDEX "InventoryMovement_referenceId_idx" ON "InventoryMovement"("referenceId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_branchId_organizationId_fkey" FOREIGN KEY ("productId", "branchId", "organizationId") REFERENCES "Inventory"("productId", "branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
