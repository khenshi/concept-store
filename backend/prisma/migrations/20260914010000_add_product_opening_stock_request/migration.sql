ALTER TABLE "Product"
  ADD COLUMN "creationRequestId" UUID,
  ADD COLUMN "creationActorId" TEXT,
  ADD COLUMN "creationCommand" JSONB;

CREATE UNIQUE INDEX "Product_organizationId_creationRequestId_key"
  ON "Product"("organizationId", "creationRequestId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_creationActorId_fkey"
  FOREIGN KEY ("creationActorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_creation_metadata_check" CHECK (
  ("creationRequestId" IS NULL AND "creationActorId" IS NULL AND "creationCommand" IS NULL)
  OR
  ("creationRequestId" IS NOT NULL AND "creationActorId" IS NOT NULL
   AND "creationCommand" IS NOT NULL AND jsonb_typeof("creationCommand") = 'object')
);
