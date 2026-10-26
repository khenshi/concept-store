BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Sale") OR EXISTS (SELECT 1 FROM "Refund") THEN
    RAISE EXCEPTION 'Plan 08 requires empty Sale and Refund source tables. Stop for an approved preservation strategy; do not reset a live database.';
  END IF;
END $$;

CREATE TYPE "PaymentAccountAssignmentMode" AS ENUM ('ALL', 'SELECTED');
CREATE TABLE "PaymentAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "normalizedName" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "assignmentMode" "PaymentAccountAssignmentMode" NOT NULL,
  "systemKey" VARCHAR(4),
  "requiresReference" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAccount_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 100 AND "name" = btrim("name") AND "normalizedName" = lower("name")),
  CONSTRAINT "PaymentAccount_version_check" CHECK ("version" > 0),
  CONSTRAINT "PaymentAccount_cash_check" CHECK (
    ("systemKey" IS NULL AND "normalizedName" <> 'cash') OR
    ("systemKey" IS NOT NULL AND "systemKey" = 'CASH' AND "name" = 'Cash' AND "enabled" AND "assignmentMode" = 'ALL' AND NOT "requiresReference")
  )
);
CREATE UNIQUE INDEX "PaymentAccount_id_organizationId_key" ON "PaymentAccount"("id", "organizationId");
CREATE UNIQUE INDEX "PaymentAccount_organizationId_normalizedName_key" ON "PaymentAccount"("organizationId", "normalizedName");
CREATE UNIQUE INDEX "PaymentAccount_organizationId_systemKey_key" ON "PaymentAccount"("organizationId", "systemKey");
CREATE INDEX "PaymentAccount_organizationId_enabled_name_idx" ON "PaymentAccount"("organizationId", "enabled", "name");
CREATE TABLE "PaymentAccountBranch" (
  "organizationId" TEXT NOT NULL,
  "paymentAccountId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  PRIMARY KEY ("paymentAccountId", "branchId"),
  FOREIGN KEY ("paymentAccountId", "organizationId") REFERENCES "PaymentAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "PaymentAccountBranch_organizationId_branchId_paymentAccountId_idx" ON "PaymentAccountBranch"("organizationId", "branchId", "paymentAccountId");
CREATE FUNCTION protect_payment_account_branch_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Replace branch assignments with delete and insert'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentAccountBranch_immutable_identity" BEFORE UPDATE ON "PaymentAccountBranch" FOR EACH ROW EXECUTE FUNCTION protect_payment_account_branch_identity();

CREATE FUNCTION provision_organization_cash() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO "PaymentAccount" ("id", "organizationId", "name", "normalizedName", "systemKey", "enabled", "assignmentMode", "requiresReference", "updatedAt")
  VALUES (gen_random_uuid()::text, NEW."id", 'Cash', 'cash', 'CASH', true, 'ALL', false, CURRENT_TIMESTAMP)
  ON CONFLICT ("organizationId", "systemKey") DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER "Organization_provision_cash" AFTER INSERT ON "Organization" FOR EACH ROW EXECUTE FUNCTION provision_organization_cash();
INSERT INTO "PaymentAccount" ("id", "organizationId", "name", "normalizedName", "systemKey", "enabled", "assignmentMode", "requiresReference", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'Cash', 'cash', 'CASH', true, 'ALL', false, CURRENT_TIMESTAMP FROM "Organization";

CREATE FUNCTION protect_payment_account_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."systemKey" = 'CASH' THEN RAISE EXCEPTION 'System Cash cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."systemKey" IS DISTINCT FROM OLD."systemKey" THEN
    RAISE EXCEPTION 'Payment account identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentAccount_immutable_identity" BEFORE UPDATE OR DELETE ON "PaymentAccount" FOR EACH ROW EXECUTE FUNCTION protect_payment_account_identity();

CREATE FUNCTION check_payment_account_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id TEXT; mode "PaymentAccountAssignmentMode"; has_branches BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'PaymentAccount' THEN account_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN account_id := OLD."paymentAccountId";
  ELSE account_id := NEW."paymentAccountId";
  END IF;
  SELECT "assignmentMode" INTO mode FROM "PaymentAccount" WHERE "id" = account_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT EXISTS (SELECT 1 FROM "PaymentAccountBranch" WHERE "paymentAccountId" = account_id) INTO has_branches;
  IF (mode = 'ALL' AND has_branches) OR (mode = 'SELECTED' AND NOT has_branches) THEN RAISE EXCEPTION 'Invalid payment account branch assignment'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "PaymentAccount_assignment_check" AFTER INSERT OR UPDATE ON "PaymentAccount" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_payment_account_assignment();
CREATE CONSTRAINT TRIGGER "PaymentAccountBranch_assignment_check" AFTER INSERT OR UPDATE OR DELETE ON "PaymentAccountBranch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_payment_account_assignment();

ALTER TABLE "Sale" DROP CONSTRAINT "Sale_payment_check", DROP COLUMN "paymentMethod",
  ADD COLUMN "paymentAccountId" TEXT NOT NULL,
  ADD COLUMN "paymentAccountName" VARCHAR(100) NOT NULL,
  ADD COLUMN "paymentAccountIsCash" BOOLEAN NOT NULL,
  ADD COLUMN "paymentAccountRequiresReference" BOOLEAN NOT NULL,
  ADD CONSTRAINT "Sale_paymentAccountId_organizationId_fkey" FOREIGN KEY ("paymentAccountId", "organizationId") REFERENCES "PaymentAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "Sale_payment_check" CHECK (
    char_length(btrim("paymentAccountName")) BETWEEN 1 AND 100 AND "paymentAccountName" = btrim("paymentAccountName") AND
    (("paymentAccountIsCash" AND NOT "paymentAccountRequiresReference" AND "paymentReference" IS NULL
      AND "cashTender" IS NOT NULL AND "cashChange" IS NOT NULL AND "cashTender" >= "total"
      AND "cashTender" <= 9999999999999999999999.99 AND "cashChange" = "cashTender" - "total")
    OR (NOT "paymentAccountIsCash" AND "cashTender" IS NULL AND "cashChange" IS NULL
      AND (NOT "paymentAccountRequiresReference" OR "paymentReference" IS NOT NULL)
      AND ("paymentReference" IS NULL OR (char_length(btrim("paymentReference")) BETWEEN 2 AND 100 AND "paymentReference" = btrim("paymentReference")))))
  );
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_payment_check", DROP COLUMN "paymentMethod",
  ADD COLUMN "paymentAccountId" TEXT NOT NULL,
  ADD COLUMN "paymentAccountName" VARCHAR(100) NOT NULL,
  ADD COLUMN "paymentAccountIsCash" BOOLEAN NOT NULL,
  ADD COLUMN "paymentAccountRequiresReference" BOOLEAN NOT NULL,
  ADD CONSTRAINT "Refund_paymentAccountId_organizationId_fkey" FOREIGN KEY ("paymentAccountId", "organizationId") REFERENCES "PaymentAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "Refund_payment_check" CHECK (
    char_length(btrim("paymentAccountName")) BETWEEN 1 AND 100 AND "paymentAccountName" = btrim("paymentAccountName") AND
    (("paymentAccountIsCash" AND NOT "paymentAccountRequiresReference" AND "paymentReference" IS NULL)
    OR (NOT "paymentAccountIsCash" AND (NOT "paymentAccountRequiresReference" OR "paymentReference" IS NOT NULL)
      AND ("paymentReference" IS NULL OR (char_length(btrim("paymentReference")) BETWEEN 2 AND 100 AND "paymentReference" = btrim("paymentReference")))))
  );
DROP TYPE "SalePaymentMethod";
CREATE INDEX "Sale_organizationId_branchId_paymentAccountId_completedAt_idx" ON "Sale"("organizationId", "branchId", "paymentAccountId", "completedAt");
CREATE INDEX "Refund_organizationId_branchId_paymentAccountId_completedAt_idx" ON "Refund"("organizationId", "branchId", "paymentAccountId", "completedAt");

CREATE FUNCTION protect_payment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW."paymentAccountId", NEW."paymentAccountName", NEW."paymentAccountIsCash", NEW."paymentAccountRequiresReference") IS DISTINCT FROM
     (OLD."paymentAccountId", OLD."paymentAccountName", OLD."paymentAccountIsCash", OLD."paymentAccountRequiresReference") THEN
    RAISE EXCEPTION 'Completed payment snapshots are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Sale_payment_snapshot_immutable" BEFORE UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_payment_snapshot();
CREATE TRIGGER "Refund_payment_snapshot_immutable" BEFORE UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION protect_payment_snapshot();
COMMIT;
