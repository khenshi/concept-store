CREATE TYPE "MemberAccessEventOperation" AS ENUM ('ROLE_CHANGED', 'MERCHANT_LINKED', 'MERCHANT_UNLINKED', 'BRANCH_GRANTED', 'BRANCH_REVOKED', 'MEMBER_REMOVED');

CREATE TABLE "MemberAccessEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" "MemberAccessEventOperation" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,

    CONSTRAINT "MemberAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberAccessEvent_organizationId_occurredAt_id_idx" ON "MemberAccessEvent"("organizationId", "occurredAt", "id");
CREATE INDEX "MemberAccessEvent_organizationId_targetUserId_occurredAt_id_idx" ON "MemberAccessEvent"("organizationId", "targetUserId", "occurredAt", "id");

ALTER TABLE "MemberAccessEvent"
  ADD CONSTRAINT "MemberAccessEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
