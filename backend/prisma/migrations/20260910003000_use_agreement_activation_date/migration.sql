ALTER TABLE "MerchantAgreement"
  ALTER COLUMN "activationAt" TYPE DATE
  USING ((("activationAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date);
