-- Apply the revised opt-in rent deduction policy consistently to agreement
-- history that can still participate in an unsettled live period. Finalized
-- settlements retain their immutable term snapshots.
UPDATE "MerchantAgreement"
SET "rentCollectionMethod" = 'PAID_SEPARATELY';
