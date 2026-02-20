import { sql, relations } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const biensRelations = relations(biens, ({ one }) => ({
  gestionnaire: one(gestionnaires, {
    fields: [biens.gestionnaireId],
    references: [gestionnaires.id],
  }),
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
