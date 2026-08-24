-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ENDED');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "MerchantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_organizationId_code_key" ON "Merchant"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Merchant_organizationId_status_idx" ON "Merchant"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Merchant_organizationId_name_idx" ON "Merchant"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
