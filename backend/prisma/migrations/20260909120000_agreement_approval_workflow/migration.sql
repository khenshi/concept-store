CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "MerchantAgreement"
  ADD COLUMN "activationAt" TIMESTAMP(3),
  ADD COLUMN "draftSlot" INTEGER,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "returnedById" TEXT,
  ADD COLUMN "returnReason" TEXT,
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedById" TEXT,
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "lastActivationAttemptAt" TIMESTAMP(3),
  ADD COLUMN "activationFailureReason" TEXT,
  ADD COLUMN "securityDepositAmount" DECIMAL(12,2),
  ADD COLUMN "firstRentPaymentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rentDueWeek" "RentDueWeek",
  ADD COLUMN "rentDueWeekday" "RentDueWeekday";

UPDATE "MerchantAgreement"
SET "activationAt" = COALESCE("activatedAt", "startDate"::timestamp);
ALTER TABLE "MerchantAgreement" ALTER COLUMN "activationAt" SET NOT NULL;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId", "merchantId"
    ORDER BY "updatedAt" DESC, "createdAt" DESC, "id"
  ) AS position
  FROM "MerchantAgreement"
  WHERE "status" = 'DRAFT'
)
UPDATE "MerchantAgreement" AS agreement
SET "status" = 'SUSPENDED',
    "suspendedAt" = CURRENT_TIMESTAMP,
    "suspensionReason" = 'Migration cleanup: draft exceeded the five-draft limit'
FROM ranked
WHERE agreement."id" = ranked."id" AND ranked.position > 5;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId", "merchantId"
    ORDER BY "updatedAt" DESC, "createdAt" DESC, "id"
  ) AS position
  FROM "MerchantAgreement"
  WHERE "status" = 'DRAFT'
)
UPDATE "MerchantAgreement" AS agreement
SET "draftSlot" = ranked.position
FROM ranked
WHERE agreement."id" = ranked."id";

ALTER TABLE "MerchantAgreement"
  ADD CONSTRAINT "MerchantAgreement_draft_slot_check"
    CHECK (("status" = 'DRAFT' AND "draftSlot" BETWEEN 1 AND 5) OR ("status" <> 'DRAFT' AND "draftSlot" IS NULL)),
  ADD CONSTRAINT "MerchantAgreement_security_deposit_check"
    CHECK ("securityDepositAmount" IS NULL OR "securityDepositAmount" > 0),
  ADD CONSTRAINT "MerchantAgreement_rent_schedule_check"
    CHECK (("fixedRentAmount" IS NULL AND "rentDueWeek" IS NULL AND "rentDueWeekday" IS NULL AND "firstRentPaymentRequired" = false)
      OR ("fixedRentAmount" IS NOT NULL AND (("rentDueWeek" IS NULL AND "rentDueWeekday" IS NULL) OR ("rentDueWeek" IS NOT NULL AND "rentDueWeekday" IS NOT NULL))));

DROP INDEX IF EXISTS "MerchantAgreement_active_merchant_key";
CREATE UNIQUE INDEX "MerchantAgreement_active_merchant_key"
  ON "MerchantAgreement"("organizationId", "merchantId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "MerchantAgreement_pending_merchant_key"
  ON "MerchantAgreement"("organizationId", "merchantId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "MerchantAgreement_draft_slot_key"
  ON "MerchantAgreement"("organizationId", "merchantId", "draftSlot") WHERE "status" = 'DRAFT';

ALTER TABLE "SpaceAssignment" ADD COLUMN "agreementId" TEXT;
CREATE INDEX "SpaceAssignment_organizationId_agreementId_idx" ON "SpaceAssignment"("organizationId", "agreementId");
ALTER TABLE "SpaceAssignment" ADD CONSTRAINT "SpaceAssignment_agreementId_organizationId_fkey"
  FOREIGN KEY ("agreementId", "organizationId") REFERENCES "MerchantAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MerchantAgreementSpace" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantAgreementSpace_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantAgreementSpace_period_check" CHECK ("periodEnd" >= "periodStart")
);
CREATE UNIQUE INDEX "MerchantAgreementSpace_agreementId_spaceId_key" ON "MerchantAgreementSpace"("agreementId", "spaceId");
CREATE INDEX "MerchantAgreementSpace_space_period_idx" ON "MerchantAgreementSpace"("organizationId", "spaceId", "periodStart", "periodEnd");
CREATE INDEX "MerchantAgreementSpace_agreement_release_idx" ON "MerchantAgreementSpace"("organizationId", "agreementId", "releasedAt");
ALTER TABLE "MerchantAgreementSpace" ADD CONSTRAINT "MerchantAgreementSpace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAgreementSpace" ADD CONSTRAINT "MerchantAgreementSpace_agreementId_organizationId_fkey" FOREIGN KEY ("agreementId", "organizationId") REFERENCES "MerchantAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAgreementSpace" ADD CONSTRAINT "MerchantAgreementSpace_spaceId_branchId_organizationId_fkey" FOREIGN KEY ("spaceId", "branchId", "organizationId") REFERENCES "Space"("id", "branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAgreementSpace" ADD CONSTRAINT "MerchantAgreementSpace_no_overlap"
  EXCLUDE USING gist ("organizationId" WITH =, "spaceId" WITH =, daterange("periodStart", "periodEnd", '[]') WITH &&)
  WHERE ("releasedAt" IS NULL);

CREATE TABLE "AgreementPrepayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "kind" "AgreementPrepaymentKind" NOT NULL,
  "requiredAmount" DECIMAL(14,2) NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgreementPrepayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgreementPrepayment_amount_check" CHECK ("requiredAmount" > 0)
);
CREATE UNIQUE INDEX "AgreementPrepayment_agreement_kind_key" ON "AgreementPrepayment"("organizationId", "agreementId", "kind");
CREATE UNIQUE INDEX "AgreementPrepayment_tenant_key" ON "AgreementPrepayment"("id", "merchantId", "organizationId");
CREATE INDEX "AgreementPrepayment_merchant_kind_idx" ON "AgreementPrepayment"("organizationId", "merchantId", "kind");
ALTER TABLE "AgreementPrepayment" ADD CONSTRAINT "AgreementPrepayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPrepayment" ADD CONSTRAINT "AgreementPrepayment_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPrepayment" ADD CONSTRAINT "AgreementPrepayment_agreementId_organizationId_fkey" FOREIGN KEY ("agreementId", "organizationId") REFERENCES "MerchantAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AgreementPrepaymentTransaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "prepaymentId" TEXT NOT NULL,
  "type" "AgreementPrepaymentTransactionType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" "PaymentMethod",
  "referenceNumber" TEXT,
  "reason" TEXT,
  "requestId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementPrepaymentTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgreementPrepaymentTransaction_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "AgreementPrepaymentTransaction_tenant_key" ON "AgreementPrepaymentTransaction"("id", "organizationId");
CREATE UNIQUE INDEX "AgreementPrepaymentTransaction_request_key" ON "AgreementPrepaymentTransaction"("organizationId", "requestId");
CREATE INDEX "AgreementPrepaymentTransaction_history_idx" ON "AgreementPrepaymentTransaction"("organizationId", "prepaymentId", "occurredAt");
ALTER TABLE "AgreementPrepaymentTransaction" ADD CONSTRAINT "AgreementPrepaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPrepaymentTransaction" ADD CONSTRAINT "AgreementPrepaymentTransaction_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPrepaymentTransaction" ADD CONSTRAINT "AgreementPrepaymentTransaction_prepaymentId_merchantId_organizationId_fkey" FOREIGN KEY ("prepaymentId", "merchantId", "organizationId") REFERENCES "AgreementPrepayment"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPrepaymentTransaction" ADD CONSTRAINT "AgreementPrepaymentTransaction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
