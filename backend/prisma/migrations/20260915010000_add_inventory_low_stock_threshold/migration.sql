ALTER TABLE "BranchInventory"
ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD CONSTRAINT "BranchInventory_lowStockThreshold_check"
CHECK ("lowStockThreshold" >= 0);
