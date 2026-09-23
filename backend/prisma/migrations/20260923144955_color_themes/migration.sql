-- RenameForeignKey
ALTER TABLE "InventoryMovement" RENAME CONSTRAINT "InventoryMovement_saleItem_scope_fkey" TO "InventoryMovement_saleItemId_organizationId_branchId_branc_fkey";

-- RenameForeignKey
ALTER TABLE "SaleItem" RENAME CONSTRAINT "SaleItem_inventory_scope_fkey" TO "SaleItem_branchInventoryId_organizationId_branchId_product_fkey";

-- RenameForeignKey
ALTER TABLE "SaleItem" RENAME CONSTRAINT "SaleItem_merchant_scope_fkey" TO "SaleItem_merchantId_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "SaleItem" RENAME CONSTRAINT "SaleItem_product_merchant_scope_fkey" TO "SaleItem_productId_organizationId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "SaleItem" RENAME CONSTRAINT "SaleItem_sale_scope_fkey" TO "SaleItem_saleId_organizationId_branchId_fkey";
