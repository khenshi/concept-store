-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "merchantId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationInvitation" ADD COLUMN     "merchantId" TEXT;

-- CreateTable
CREATE TABLE "BranchMembership" (
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchMembership_pkey" PRIMARY KEY ("organizationId","branchId","userId")
);

-- CreateTable
CREATE TABLE "InvitationBranch" (
    "invitationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "InvitationBranch_pkey" PRIMARY KEY ("invitationId","branchId")
);

-- CreateIndex
CREATE INDEX "BranchMembership_organizationId_userId_idx" ON "BranchMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "InvitationBranch_branchId_organizationId_idx" ON "InvitationBranch"("branchId", "organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_merchantId_idx" ON "OrganizationMembership"("organizationId", "merchantId");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_merchantId_idx" ON "OrganizationInvitation"("organizationId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_id_organizationId_key" ON "OrganizationInvitation"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationBranch" ADD CONSTRAINT "InvitationBranch_invitationId_organizationId_fkey" FOREIGN KEY ("invitationId", "organizationId") REFERENCES "OrganizationInvitation"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationBranch" ADD CONSTRAINT "InvitationBranch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Legacy merchant members/invitations may remain unlinked, but other roles cannot carry links.
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_merchant_role_check" CHECK ("merchantId" IS NULL OR "role" = 'MERCHANT');
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_merchant_role_check" CHECK ("merchantId" IS NULL OR "role" = 'MERCHANT');
