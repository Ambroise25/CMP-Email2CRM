CREATE TABLE "biens" (
	"id" serial PRIMARY KEY NOT NULL,
	"adresse" text NOT NULL,
	"complement_adresse" text,
	"code_postal" text NOT NULL,
	"ville" text NOT NULL,
	"gestionnaire_id" integer NOT NULL,
	"information" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"demande_id" integer NOT NULL,
	"nom" text,
	"telephone" text,
	"email" text,
	"qualite" text DEFAULT 'autre' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bien_id" integer NOT NULL,
	"objet" text NOT NULL,
	"etat" text DEFAULT 'nouvelle' NOT NULL,
	"metier" text NOT NULL,
	"detail" text,
	"commentaire" text,
	"gestionnaire_id" integer NOT NULL,
	"date_demande_client" timestamp NOT NULL,
	"ref_syndic" text,
	"travaux_enerpur" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"demande_id" integer NOT NULL,
	"nom" text NOT NULL,
	"mime_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"received_at" timestamp NOT NULL,
	"from" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"statut" text DEFAULT 'traite' NOT NULL,
	"demande_id" integer,
	"erreur" text,
	"raw_parsed" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_logs_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "gestionnaires" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"email" text,
	"telephone" text
);
--> statement-breakpoint
ALTER TABLE "biens" ADD CONSTRAINT "biens_gestionnaire_id_gestionnaires_id_fk" FOREIGN KEY ("gestionnaire_id") REFERENCES "public"."gestionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_bien_id_biens_id_fk" FOREIGN KEY ("bien_id") REFERENCES "public"."biens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_gestionnaire_id_gestionnaires_id_fk" FOREIGN KEY ("gestionnaire_id") REFERENCES "public"."gestionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_biens_code_postal" ON "biens" USING btree ("code_postal");--> statement-breakpoint
CREATE INDEX "idx_biens_adresse" ON "biens" USING btree ("adresse");--> statement-breakpoint
CREATE INDEX "idx_contacts_demande_id" ON "contacts" USING btree ("demande_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_qualite" ON "contacts" USING btree ("qualite");--> statement-breakpoint
CREATE INDEX "idx_demandes_bien_id" ON "demandes" USING btree ("bien_id");--> statement-breakpoint
CREATE INDEX "idx_demandes_etat" ON "demandes" USING btree ("etat");--> statement-breakpoint
CREATE INDEX "idx_demandes_created_at" ON "demandes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_documents_demande_id" ON "documents" USING btree ("demande_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_message_id" ON "email_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_created_at" ON "email_logs" USING btree ("created_at");