CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
ON "OrganizationInvitation"("tokenHash");

CREATE INDEX "OrganizationInvitation_organizationId_email_idx"
ON "OrganizationInvitation"("organizationId", "email");

CREATE INDEX "OrganizationInvitation_organizationId_expiresAt_idx"
ON "OrganizationInvitation"("organizationId", "expiresAt");

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
