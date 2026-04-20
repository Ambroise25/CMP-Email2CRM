ALTER TABLE "contacts" ADD COLUMN "auto_generated" boolean DEFAULT false NOT NULL;
UPDATE "contacts" SET "auto_generated" = true;
