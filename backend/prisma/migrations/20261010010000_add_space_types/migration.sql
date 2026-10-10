BEGIN;
LOCK TABLE "Space" IN ACCESS EXCLUSIVE MODE;
CREATE TABLE "SpaceType" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpaceType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpaceType_name_check" CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80),
  CONSTRAINT "SpaceType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpaceType_organizationId_name_key" ON "SpaceType"("organizationId", "name");
CREATE UNIQUE INDEX "SpaceType_organizationId_lower_name_key" ON "SpaceType"("organizationId", lower("name"));
INSERT INTO "SpaceType" ("id", "organizationId", "name")
SELECT gen_random_uuid()::text, "organizationId", "name" FROM (
  SELECT DISTINCT ON ("organizationId", lower(btrim("type"))) "organizationId", btrim("type") AS "name"
  FROM "Space" ORDER BY "organizationId", lower(btrim("type")), btrim("type") COLLATE "C"
) AS existing;
UPDATE "Space" AS s SET "type" = t."name" FROM "SpaceType" AS t
WHERE s."organizationId" = t."organizationId" AND lower(btrim(s."type")) = lower(t."name");
CREATE FUNCTION register_space_type() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical TEXT;
BEGIN
  SELECT "name" INTO canonical FROM "SpaceType"
  WHERE "organizationId" = NEW."organizationId" AND lower("name") = lower(btrim(NEW."type"));
  IF canonical IS NULL THEN
    INSERT INTO "SpaceType" ("id", "organizationId", "name")
    VALUES (gen_random_uuid()::text, NEW."organizationId", btrim(NEW."type")) ON CONFLICT DO NOTHING;
    SELECT "name" INTO canonical FROM "SpaceType"
    WHERE "organizationId" = NEW."organizationId" AND lower("name") = lower(btrim(NEW."type"));
  END IF;
  NEW."type" := canonical;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Space_register_type" BEFORE INSERT OR UPDATE OF "type", "organizationId" ON "Space"
FOR EACH ROW EXECUTE FUNCTION register_space_type();
ALTER TABLE "Space" ADD CONSTRAINT "Space_organizationId_type_fkey"
FOREIGN KEY ("organizationId", "type") REFERENCES "SpaceType"("organizationId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
