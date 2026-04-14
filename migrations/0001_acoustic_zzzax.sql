ALTER TABLE "biens" ALTER COLUMN "gestionnaire_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "demandes" ALTER COLUMN "gestionnaire_id" DROP NOT NULL;
