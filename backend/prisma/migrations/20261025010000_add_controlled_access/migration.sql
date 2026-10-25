CREATE TYPE "AccountActionTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OrganizationLifecycleAction" AS ENUM ('PROVISION', 'ACTIVATE', 'DEACTIVATE', 'RENAME');

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "pendingRegistrationId" TEXT,
    "purpose" "AccountActionTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationLifecycleEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" "OrganizationLifecycleAction" NOT NULL,
    "operationId" TEXT NOT NULL,
    "operatorIdentity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousStatus" "OrganizationStatus",
    "nextStatus" "OrganizationStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
CREATE UNIQUE INDEX "AccountActionToken_tokenHash_key" ON "AccountActionToken"("tokenHash");
CREATE UNIQUE INDEX "OrganizationLifecycleEvent_operationId_key" ON "OrganizationLifecycleEvent"("operationId");
CREATE INDEX "PendingRegistration_createdAt_idx" ON "PendingRegistration"("createdAt");
CREATE INDEX "AccountActionToken_userId_purpose_expiresAt_idx" ON "AccountActionToken"("userId", "purpose", "expiresAt");
CREATE INDEX "AccountActionToken_pendingRegistrationId_purpose_expiresAt_idx" ON "AccountActionToken"("pendingRegistrationId", "purpose", "expiresAt");
CREATE INDEX "OrganizationLifecycleEvent_organizationId_createdAt_idx" ON "OrganizationLifecycleEvent"("organizationId", "createdAt");

ALTER TABLE "AccountActionToken"
  ADD CONSTRAINT "AccountActionToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountActionToken"
  ADD CONSTRAINT "AccountActionToken_pendingRegistrationId_fkey"
  FOREIGN KEY ("pendingRegistrationId") REFERENCES "PendingRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationLifecycleEvent"
  ADD CONSTRAINT "OrganizationLifecycleEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountActionToken"
  ADD CONSTRAINT "AccountActionToken_exactly_one_subject_check"
  CHECK ((CASE WHEN "userId" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "pendingRegistrationId" IS NOT NULL THEN 1 ELSE 0 END) = 1);
