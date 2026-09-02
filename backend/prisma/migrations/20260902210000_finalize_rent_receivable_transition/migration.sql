ALTER TABLE "MerchantAgreement" DROP COLUMN "rentCollectionMethod";

WITH agreement_months AS (
  SELECT
    agreement."organizationId",
    agreement."merchantId",
    agreement."id" AS "agreementId",
    agreement."fixedRentAmount",
    month_start::date AS "sourcePeriod",
    (month_start + INTERVAL '1 month - 1 day')::date AS "dueDate",
    agreement."startDate"
  FROM "MerchantAgreement" agreement
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', agreement."startDate")::date,
    LEAST(
      date_trunc('month', COALESCE(agreement."endDate", CURRENT_DATE))::date,
      date_trunc('month', CURRENT_DATE)::date
    ),
    INTERVAL '1 month'
  ) month_start
  WHERE agreement."fixedRentAmount" IS NOT NULL
    AND agreement."status" IN ('ACTIVE', 'ENDED')
), selected_months AS (
  SELECT DISTINCT ON ("organizationId", "merchantId", "sourcePeriod") *
  FROM agreement_months
  ORDER BY "organizationId", "merchantId", "sourcePeriod", "startDate" DESC, "agreementId"
), prepared AS (
  SELECT
    substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-4' ||
      substr(hash.value, 14, 3) || '-8' || substr(hash.value, 18, 3) || '-' ||
      substr(hash.value, 21, 12) AS id,
    selected_months.*
  FROM selected_months
  CROSS JOIN LATERAL (
    SELECT md5(
      "organizationId" || ':' || "merchantId" || ':' || "sourcePeriod"::text || ':rent'
    ) AS value
  ) hash
)
INSERT INTO "MerchantReceivable" (
  "id", "organizationId", "merchantId", "agreementId", "type",
  "sourcePeriod", "originalAmount", "remainingAmount", "dueDate",
  "status", "createdAt", "updatedAt"
)
SELECT
  id, "organizationId", "merchantId", "agreementId", 'RENT',
  "sourcePeriod", "fixedRentAmount", "fixedRentAmount", "dueDate",
  CASE WHEN "dueDate" < CURRENT_DATE THEN 'OVERDUE'::"MerchantReceivableStatus"
       ELSE 'OPEN'::"MerchantReceivableStatus" END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM prepared
ON CONFLICT ("organizationId", "merchantId", "type", "sourcePeriod") DO NOTHING;

INSERT INTO "MerchantReceivableTransaction" (
  "id", "organizationId", "merchantId", "receivableId", "type", "amount",
  "note", "occurredAt", "recordedById", "createdAt"
)
SELECT
  substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-4' ||
    substr(hash.value, 14, 3) || '-8' || substr(hash.value, 18, 3) || '-' ||
    substr(hash.value, 21, 12),
  entry."organizationId", entry."merchantId", receivable."id", 'PAYMENT',
  entry."amount", entry."reason", entry."occurredAt", entry."createdById",
  entry."createdAt"
FROM "SettlementAdjustment" entry
JOIN "MerchantReceivable" receivable
  ON receivable."organizationId" = entry."organizationId"
 AND receivable."merchantId" = entry."merchantId"
 AND receivable."sourcePeriod" = date_trunc('month', entry."occurredAt")::date
CROSS JOIN LATERAL (
  SELECT md5(entry."id" || ':rent-payment') AS value
) hash
WHERE entry."type" = 'MERCHANT_PAYMENT';

INSERT INTO "SettlementReceivableAllocation" (
  "settlementId", "receivableId", "organizationId", "merchantId", "amount",
  "appliedAt", "createdAt"
)
SELECT
  settlement."id", receivable."id", settlement."organizationId",
  settlement."merchantId",
  LEAST(settlement."fixedRentAmount", receivable."originalAmount"),
  CASE WHEN settlement."status" = 'PAID' THEN settlement."updatedAt" ELSE NULL END,
  settlement."createdAt"
FROM "MerchantSettlement" settlement
JOIN "MerchantReceivable" receivable
  ON receivable."organizationId" = settlement."organizationId"
 AND receivable."merchantId" = settlement."merchantId"
 AND receivable."sourcePeriod" = date_trunc('month', settlement."periodEnd")::date
WHERE settlement."fixedRentAmount" > 0
ON CONFLICT ("settlementId", "receivableId") DO NOTHING;

INSERT INTO "MerchantReceivableTransaction" (
  "id", "organizationId", "merchantId", "receivableId", "settlementId",
  "type", "amount", "occurredAt", "recordedById", "createdAt"
)
SELECT
  substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-4' ||
    substr(hash.value, 14, 3) || '-8' || substr(hash.value, 18, 3) || '-' ||
    substr(hash.value, 21, 12),
  allocation."organizationId", allocation."merchantId",
  allocation."receivableId", allocation."settlementId",
  'SETTLEMENT_DEDUCTION', allocation."amount", allocation."appliedAt",
  settlement."approvedById", allocation."createdAt"
FROM "SettlementReceivableAllocation" allocation
JOIN "MerchantSettlement" settlement ON settlement."id" = allocation."settlementId"
CROSS JOIN LATERAL (
  SELECT md5(
    allocation."settlementId" || ':' || allocation."receivableId" || ':rent-offset'
  ) AS value
) hash
WHERE allocation."appliedAt" IS NOT NULL
  AND settlement."approvedById" IS NOT NULL;

WITH applied AS (
  SELECT
    receivable."id",
    COALESCE((
      SELECT SUM(transaction."amount")
      FROM "MerchantReceivableTransaction" transaction
      WHERE transaction."receivableId" = receivable."id"
        AND transaction."type" IN ('PAYMENT', 'SETTLEMENT_DEDUCTION')
    ), 0) AS paid
  FROM "MerchantReceivable" receivable
)
UPDATE "MerchantReceivable" receivable
SET
  "remainingAmount" = GREATEST(receivable."originalAmount" - applied.paid, 0),
  "status" = CASE
    WHEN receivable."originalAmount" - applied.paid <= 0 THEN 'PAID'::"MerchantReceivableStatus"
    WHEN receivable."dueDate" < CURRENT_DATE THEN 'OVERDUE'::"MerchantReceivableStatus"
    WHEN applied.paid > 0 THEN 'PARTIALLY_PAID'::"MerchantReceivableStatus"
    ELSE 'OPEN'::"MerchantReceivableStatus"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM applied
WHERE receivable."id" = applied."id";
