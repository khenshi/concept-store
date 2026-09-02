-- Rent is collected separately by default. Active and draft agreements adopt
-- the safer policy; ended agreements retain their historical collection mode.
ALTER TABLE "MerchantAgreement"
  ALTER COLUMN "rentCollectionMethod" SET DEFAULT 'PAID_SEPARATELY';

UPDATE "MerchantAgreement"
SET "rentCollectionMethod" = 'PAID_SEPARATELY'
WHERE "status" IN ('DRAFT', 'ACTIVE');

-- Collection timing is no longer an agreement choice. Historical settlement
-- snapshots retain their timing field so finalized records remain unchanged.
ALTER TABLE "MerchantAgreement"
  DROP COLUMN "rentDeductionTiming";
