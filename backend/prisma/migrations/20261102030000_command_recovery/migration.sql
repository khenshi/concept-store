BEGIN;

CREATE TYPE "CommandRecoveryKind" AS ENUM ('CHECKOUT', 'REFUND');
CREATE TYPE "CommandRecoveryState" AS ENUM ('PREPARED', 'SUBMITTED', 'COMPLETED', 'ACKNOWLEDGED', 'ABANDONED');

CREATE TABLE "CommandRecovery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "kind" "CommandRecoveryKind" NOT NULL,
  "state" "CommandRecoveryState" NOT NULL DEFAULT 'PREPARED',
  "requestId" UUID NOT NULL,
  "branchId" TEXT NOT NULL,
  "saleId" TEXT,
  "commandVersion" INTEGER NOT NULL DEFAULT 1,
  "command" JSONB NOT NULL,
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "CommandRecovery_commandVersion_check" CHECK ("commandVersion" > 0),
  CONSTRAINT "CommandRecovery_lifecycle_check" CHECK (
    ("state" = 'PREPARED' AND "completedAt" IS NULL AND "acknowledgedAt" IS NULL AND "closedAt" IS NULL) OR
    ("state" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "acknowledgedAt" IS NULL AND "closedAt" IS NULL) OR
    ("state" = 'COMPLETED' AND "submittedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "acknowledgedAt" IS NULL AND "closedAt" IS NULL) OR
    ("state" = 'ACKNOWLEDGED' AND "submittedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "acknowledgedAt" IS NOT NULL AND "closedAt" IS NULL) OR
    ("state" = 'ABANDONED' AND "completedAt" IS NULL AND "acknowledgedAt" IS NULL AND "closedAt" IS NOT NULL)
  ),
  CONSTRAINT "CommandRecovery_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommandRecovery_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommandRecovery_branch_scope_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommandRecovery_organizationId_kind_requestId_key" ON "CommandRecovery"("organizationId", "kind", "requestId");
CREATE UNIQUE INDEX "CommandRecovery_blocking_actor_kind_key"
  ON "CommandRecovery"("organizationId", "actorUserId", "kind")
  WHERE "state" IN ('PREPARED', 'SUBMITTED', 'COMPLETED');
CREATE INDEX "CommandRecovery_organizationId_actorUserId_kind_state_idx"
  ON "CommandRecovery"("organizationId", "actorUserId", "kind", "state");
CREATE INDEX "CommandRecovery_organizationId_branchId_kind_createdAt_idx"
  ON "CommandRecovery"("organizationId", "branchId", "kind", "createdAt");

CREATE FUNCTION protect_command_recovery_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."actorUserId" IS DISTINCT FROM OLD."actorUserId"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."requestId" IS DISTINCT FROM OLD."requestId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."saleId" IS DISTINCT FROM OLD."saleId"
    OR NEW."commandVersion" IS DISTINCT FROM OLD."commandVersion"
    OR NEW."command" IS DISTINCT FROM OLD."command" THEN
    RAISE EXCEPTION 'Command recovery identity and command are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CommandRecovery_immutable_identity"
  BEFORE UPDATE ON "CommandRecovery"
  FOR EACH ROW EXECUTE FUNCTION protect_command_recovery_identity();

COMMIT;
