-- CreateTable
CREATE TABLE "MerchantAccount" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAccount_pkey" PRIMARY KEY ("organizationId", "userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAccount_merchantId_organizationId_key" ON "MerchantAccount"("merchantId", "organizationId");
CREATE INDEX "MerchantAccount_organizationId_merchantId_idx" ON "MerchantAccount"("organizationId", "merchantId");

-- AddForeignKey
ALTER TABLE "MerchantAccount" ADD CONSTRAINT "MerchantAccount_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantAccount" ADD CONSTRAINT "MerchantAccount_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
