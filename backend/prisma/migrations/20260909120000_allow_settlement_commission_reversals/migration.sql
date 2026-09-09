-- A refund recorded after its original sale was captured must return the
-- original commission without rewriting the finalized settlement. The total
-- settlement commission can therefore be negative, but never by more than the
-- completed refund amount (agreement rates are capped at 100%).
ALTER TABLE "MerchantSettlement"
  DROP CONSTRAINT IF EXISTS "MerchantSettlement_amounts_check";

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_amounts_check" CHECK (
    "grossSales" >= 0
    AND "commissionAmount" >= -"refundTotal"
    AND "commissionAmount" <= "grossSales"
    AND "fixedRentAmount" >= 0
  );
