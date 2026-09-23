CREATE INDEX "InventoryMovement_branch_history_idx"
ON "InventoryMovement" ("organizationId", "branchId", "createdAt", "id");
