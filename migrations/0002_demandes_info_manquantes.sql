ALTER TABLE "demandes" ADD COLUMN "info_manquantes" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "demandes" ADD COLUMN "champs_manquants" text;
