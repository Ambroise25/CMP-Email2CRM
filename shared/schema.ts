import { sql, relations } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ETATS = ["nouvelle", "a_contacter", "en_attente_retour", "programmee", "terminee", "annulee"] as const;
export const METIERS = ["Etancheite", "Plomberie", "Electricite", "Autre"] as const;

export type Etat = typeof ETATS[number];
export type Metier = typeof METIERS[number];

export const etatLabels: Record<Etat, string> = {
  nouvelle: "Nouvelle",
  a_contacter: "À contacter",
  en_attente_retour: "En attente de retour",
  programmee: "Programmée",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const gestionnaires = pgTable("gestionnaires", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  email: text("email"),
  telephone: text("telephone"),
});

export const gestionnairesRelations = relations(gestionnaires, ({ many }) => ({
  biens: many(biens),
}));

export const insertGestionnaireSchema = createInsertSchema(gestionnaires).omit({
  id: true,
});

export type InsertGestionnaire = z.infer<typeof insertGestionnaireSchema>;
export type Gestionnaire = typeof gestionnaires.$inferSelect;

export const biens = pgTable("biens", {
  id: serial("id").primaryKey(),
  adresse: text("adresse").notNull(),
  complementAdresse: text("complement_adresse"),
  codePostal: text("code_postal").notNull(),
  ville: text("ville").notNull(),
  gestionnaireId: integer("gestionnaire_id").notNull().references(() => gestionnaires.id),
  information: text("information"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biens_code_postal").on(table.codePostal),
  index("idx_biens_adresse").on(table.adresse),
]);

export const biensRelations = relations(biens, ({ one, many }) => ({
  gestionnaire: one(gestionnaires, {
    fields: [biens.gestionnaireId],
    references: [gestionnaires.id],
  }),
  demandes: many(demandes),
}));

export const insertBienSchema = createInsertSchema(biens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBienSchema = insertBienSchema.partial();

export const searchBienSchema = z.object({
  adresse: z.string().min(1, "Adresse requise"),
  code_postal: z.string().min(1, "Code postal requis"),
});

export type InsertBien = z.infer<typeof insertBienSchema>;
export type UpdateBien = z.infer<typeof updateBienSchema>;
export type Bien = typeof biens.$inferSelect;

export type BienWithGestionnaire = Bien & {
  gestionnaire: Gestionnaire;
};

export type BienMatch = {
  bien: BienWithGestionnaire;
  score: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const demandes = pgTable("demandes", {
  id: serial("id").primaryKey(),
  bienId: integer("bien_id").notNull().references(() => biens.id),
  objet: text("objet").notNull(),
  etat: text("etat").notNull().default("nouvelle"),
  metier: text("metier").notNull(),
  detail: text("detail"),
  commentaire: text("commentaire"),
  gestionnaireId: integer("gestionnaire_id").notNull().references(() => gestionnaires.id),
  dateDemandeClient: timestamp("date_demande_client").notNull(),
  refSyndic: text("ref_syndic"),
  travauxEnerpur: boolean("travaux_enerpur").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_demandes_bien_id").on(table.bienId),
  index("idx_demandes_etat").on(table.etat),
  index("idx_demandes_created_at").on(table.createdAt),
]);

export const demandesRelations = relations(demandes, ({ one, many }) => ({
  bien: one(biens, {
    fields: [demandes.bienId],
    references: [biens.id],
  }),
  gestionnaire: one(gestionnaires, {
    fields: [demandes.gestionnaireId],
    references: [gestionnaires.id],
  }),
  contacts: many(contacts),
}));

export const insertDemandeSchema = createInsertSchema(demandes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  etat: z.enum(ETATS).default("nouvelle"),
  metier: z.enum(METIERS),
  dateDemandeClient: z.coerce.date(),
});

export const updateDemandeSchema = insertDemandeSchema.partial();

export type InsertDemande = z.infer<typeof insertDemandeSchema>;
export type UpdateDemande = z.infer<typeof updateDemandeSchema>;
export type Demande = typeof demandes.$inferSelect;

export type DemandeWithRelations = Demande & {
  bien: Bien;
  gestionnaire: Gestionnaire;
};

export const EMAIL_STATUTS = ["traite", "erreur", "ignore"] as const;
export type EmailStatut = typeof EMAIL_STATUTS[number];

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  receivedAt: timestamp("received_at").notNull(),
  from: text("from").notNull(),
  subject: text("subject").notNull(),
  body: text("body"),
  statut: text("statut").notNull().default("traite"),
  demandeId: integer("demande_id").references(() => demandes.id),
  erreur: text("erreur"),
  rawParsed: text("raw_parsed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_logs_message_id").on(table.messageId),
  index("idx_email_logs_created_at").on(table.createdAt),
]);

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

export type EmailLogWithDemande = EmailLog & {
  demande?: DemandeWithRelations | null;
};

export const CONTACT_QUALITES = ["gestionnaire", "proprietaire", "locataire", "conseil_syndical", "gardien", "autre"] as const;
export type ContactQualite = typeof CONTACT_QUALITES[number];

export const contactQualiteLabels: Record<ContactQualite, string> = {
  gestionnaire: "Gestionnaire (syndic)",
  proprietaire: "Propriétaire",
  locataire: "Locataire occupant",
  conseil_syndical: "Membre du conseil syndical",
  gardien: "Gardien",
  autre: "Autre",
};

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  demandeId: integer("demande_id").notNull().references(() => demandes.id),
  nom: text("nom"),
  telephone: text("telephone"),
  email: text("email"),
  qualite: text("qualite").notNull().default("autre"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_contacts_demande_id").on(table.demandeId),
  index("idx_contacts_qualite").on(table.qualite),
]);

export const contactsRelations = relations(contacts, ({ one }) => ({
  demande: one(demandes, {
    fields: [contacts.demandeId],
    references: [demandes.id],
  }),
}));

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type ContactWithDemande = Contact & {
  demande?: Demande | null;
};

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  demandeId: integer("demande_id").notNull().references(() => demandes.id),
  nom: text("nom").notNull(),
  mimeType: text("mime_type").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_documents_demande_id").on(table.demandeId),
]);

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
