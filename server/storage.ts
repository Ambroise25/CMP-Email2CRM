import {
  type Bien,
  type InsertBien,
  type UpdateBien,
  type BienWithGestionnaire,
  type BienMatch,
  type Gestionnaire,
  type InsertGestionnaire,
  type UpdateGestionnaire,
  type Demande,
  type InsertDemande,
  type UpdateDemande,
  type DemandeWithRelations,
  type PaginatedResponse,
  type EmailLog,
  type InsertEmailLog,
  type Document,
  type InsertDocument,
  type Contact,
  type InsertContact,
  type ContactWithDemande,
  biens,
  gestionnaires,
  demandes,
  emailLogs,
  documents,
  contacts,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, count, desc, inArray, or, ilike, isNull } from "drizzle-orm";

function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  const tokensA = normalizeAddress(a).split(" ");
  const tokensB = normalizeAddress(b).split(" ");

  let matchCount = 0;
  for (const token of tokensA) {
    if (tokensB.some((t) => t.includes(token) || token.includes(t))) {
      matchCount++;
    }
  }

  const maxLen = Math.max(tokensA.length, tokensB.length);
  if (maxLen === 0) return 0;

  const tokenScore = matchCount / maxLen;

  const normA = normalizeAddress(a);
  const normB = normalizeAddress(b);
  const maxStrLen = Math.max(normA.length, normB.length);
  if (maxStrLen === 0) return 0;

  let commonChars = 0;
  const shorter = normA.length <= normB.length ? normA : normB;
  const longer = normA.length <= normB.length ? normB : normA;

  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      commonChars++;
    }
  }
  const charScore = commonChars / maxStrLen;

  return tokenScore * 0.7 + charScore * 0.3;
}

export interface IStorage {
  getBiens(page: number, limit: number, search?: string, sansGestionnaire?: boolean): Promise<PaginatedResponse<BienWithGestionnaire>>;
  getBienById(id: number): Promise<BienWithGestionnaire | undefined>;
  createBien(bien: InsertBien): Promise<Bien>;
  updateBien(id: number, bien: UpdateBien): Promise<Bien | undefined>;
  searchBiens(adresse: string, codePostal: string): Promise<{ matches: BienMatch[]; best_match: BienMatch | null }>;
  getGestionnaires(): Promise<Gestionnaire[]>;
  getGestionnairesWithBienCount(): Promise<(Gestionnaire & { bienCount: number })[]>;
  getGestionnaireById(id: number): Promise<Gestionnaire | undefined>;
  createGestionnaire(gestionnaire: InsertGestionnaire): Promise<Gestionnaire>;
  updateGestionnaire(id: number, updates: UpdateGestionnaire): Promise<Gestionnaire | undefined>;
  deleteGestionnaire(id: number, reassignTo?: number): Promise<{ success: boolean; bienCount: number }>;
  countBiensByGestionnaire(gestionnaireId: number): Promise<number>;
  findOrCreateGestionnaire(nom: string, email?: string | null, telephone?: string | null, adresse?: string | null): Promise<Gestionnaire>;
  getDemandes(page: number, limit: number, filters?: { bienId?: number; etat?: string; metier?: string; excludeNouvelle?: boolean }): Promise<PaginatedResponse<DemandeWithRelations>>;
  getDemandeById(id: number): Promise<DemandeWithRelations | undefined>;
  createDemande(demande: InsertDemande): Promise<Demande>;
  updateDemande(id: number, updates: UpdateDemande): Promise<Demande | undefined>;
  getEmailLogs(page: number, limit: number, statuts?: string[]): Promise<PaginatedResponse<EmailLog>>;
  getEmailLogByDemande(demandeId: number): Promise<EmailLog | undefined>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  emailLogExists(messageId: string): Promise<boolean>;
  getDocumentsByDemande(demandeId: number): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<boolean>;
  getContacts(page: number, limit: number, qualite?: string, search?: string): Promise<PaginatedResponse<ContactWithDemande>>;
  createContacts(contactList: InsertContact[]): Promise<Contact[]>;
  reassignGestionnaires(): Promise<{ demandesUpdated: number; biensUpdated: number; unmatched: string[] }>;
}

export class DatabaseStorage implements IStorage {
  async getBiens(page: number, limit: number, search?: string, sansGestionnaire?: boolean): Promise<PaginatedResponse<BienWithGestionnaire>> {
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(sql`(${biens.adresse} ILIKE ${'%' + search + '%'} OR ${biens.ville} ILIKE ${'%' + search + '%'} OR ${biens.codePostal} ILIKE ${'%' + search + '%'})`);
    }
    if (sansGestionnaire) {
      conditions.push(isNull(biens.gestionnaireId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : sql`1=1`;

    const [totalResult] = await db
      .select({ count: count() })
      .from(biens)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const rows = await db
      .select()
      .from(biens)
      .leftJoin(gestionnaires, eq(biens.gestionnaireId, gestionnaires.id))
      .where(whereClause)
      .orderBy(biens.id)
      .limit(limit)
      .offset(offset);

    const data: BienWithGestionnaire[] = rows.map((row) => ({
      ...row.biens,
      gestionnaire: row.gestionnaires || null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBienById(id: number): Promise<BienWithGestionnaire | undefined> {
    const rows = await db
      .select()
      .from(biens)
      .leftJoin(gestionnaires, eq(biens.gestionnaireId, gestionnaires.id))
      .where(eq(biens.id, id));

    if (rows.length === 0) return undefined;

    return {
      ...rows[0].biens,
      gestionnaire: rows[0].gestionnaires || null,
    };
  }

  async createBien(bien: InsertBien): Promise<Bien> {
    const [created] = await db.insert(biens).values(bien).returning();
    return created;
  }

  async updateBien(id: number, updates: UpdateBien): Promise<Bien | undefined> {
    const [updated] = await db
      .update(biens)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(biens.id, id))
      .returning();
    return updated || undefined;
  }

  async searchBiens(adresse: string, codePostal: string): Promise<{ matches: BienMatch[]; best_match: BienMatch | null }> {
    const candidates = await db
      .select()
      .from(biens)
      .leftJoin(gestionnaires, eq(biens.gestionnaireId, gestionnaires.id))
      .where(eq(biens.codePostal, codePostal));

    const matches: BienMatch[] = [];

    for (const row of candidates) {
      const score = calculateSimilarity(adresse, row.biens.adresse);
      if (score > 0.3) {
        matches.push({
          bien: { ...row.biens, gestionnaire: row.gestionnaires || null },
          score: Math.round(score * 100) / 100,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return {
      matches,
      best_match: matches.length > 0 ? matches[0] : null,
    };
  }

  async getGestionnaires(): Promise<Gestionnaire[]> {
    return await db.select().from(gestionnaires).orderBy(gestionnaires.nom);
  }

  async getGestionnairesWithBienCount(): Promise<(Gestionnaire & { bienCount: number })[]> {
    const rows = await db
      .select({
        id: gestionnaires.id,
        nom: gestionnaires.nom,
        email: gestionnaires.email,
        telephone: gestionnaires.telephone,
        adresse: gestionnaires.adresse,
        bienCount: sql<number>`count(${biens.id})::int`,
      })
      .from(gestionnaires)
      .leftJoin(biens, eq(biens.gestionnaireId, gestionnaires.id))
      .groupBy(gestionnaires.id)
      .orderBy(gestionnaires.nom);
    return rows;
  }

  async getGestionnaireById(id: number): Promise<Gestionnaire | undefined> {
    const [g] = await db.select().from(gestionnaires).where(eq(gestionnaires.id, id));
    return g || undefined;
  }

  async createGestionnaire(gestionnaire: InsertGestionnaire): Promise<Gestionnaire> {
    const [created] = await db.insert(gestionnaires).values(gestionnaire).returning();
    return created;
  }

  async updateGestionnaire(id: number, updates: UpdateGestionnaire): Promise<Gestionnaire | undefined> {
    const [updated] = await db
      .update(gestionnaires)
      .set(updates)
      .where(eq(gestionnaires.id, id))
      .returning();
    return updated || undefined;
  }

  async countBiensByGestionnaire(gestionnaireId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(biens)
      .where(eq(biens.gestionnaireId, gestionnaireId));
    return result?.count ?? 0;
  }

  async findOrCreateGestionnaire(nom: string, email?: string | null, telephone?: string | null, adresse?: string | null): Promise<Gestionnaire> {
    const [existing] = await db
      .select()
      .from(gestionnaires)
      .where(ilike(gestionnaires.nom, `%${nom}%`))
      .limit(1);
    if (existing) {
      return existing;
    }
    const [created] = await db
      .insert(gestionnaires)
      .values({ nom, email: email || null, telephone: telephone || null, adresse: adresse || null })
      .returning();
    return created;
  }

  async deleteGestionnaire(id: number, reassignTo?: number): Promise<{ success: boolean; bienCount: number }> {
    const bienCount = await this.countBiensByGestionnaire(id);

    if (bienCount > 0) {
      if (reassignTo !== undefined) {
        await db.update(biens).set({ gestionnaireId: reassignTo }).where(eq(biens.gestionnaireId, id));
        await db.update(demandes).set({ gestionnaireId: reassignTo }).where(eq(demandes.gestionnaireId, id));
      } else {
        await db.update(biens).set({ gestionnaireId: null }).where(eq(biens.gestionnaireId, id));
        await db.update(demandes).set({ gestionnaireId: null }).where(eq(demandes.gestionnaireId, id));
      }
    } else {
      await db.update(demandes).set({ gestionnaireId: null }).where(eq(demandes.gestionnaireId, id));
    }

    await db.delete(gestionnaires).where(eq(gestionnaires.id, id));
    return { success: true, bienCount };
  }

  async getDemandes(page: number, limit: number, filters?: { bienId?: number; etat?: string; metier?: string; excludeNouvelle?: boolean }): Promise<PaginatedResponse<DemandeWithRelations>> {
    const offset = (page - 1) * limit;

    const conditions = [];
    if (filters?.bienId) {
      conditions.push(sql`${demandes.bienId} = ${filters.bienId}`);
    }
    if (filters?.etat) {
      conditions.push(sql`${demandes.etat} = ${filters.etat}`);
    }
    if (filters?.metier) {
      conditions.push(sql`${demandes.metier} = ${filters.metier}`);
    }
    if (filters?.excludeNouvelle) {
      conditions.push(sql`${demandes.etat} != 'nouvelle'`);
    }

    const whereClause = conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : sql`1=1`;

    const [totalResult] = await db
      .select({ count: count() })
      .from(demandes)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const rows = await db
      .select()
      .from(demandes)
      .leftJoin(biens, eq(demandes.bienId, biens.id))
      .leftJoin(gestionnaires, eq(demandes.gestionnaireId, gestionnaires.id))
      .where(whereClause)
      .orderBy(sql`${demandes.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data: DemandeWithRelations[] = rows.map((row) => ({
      ...row.demandes,
      bien: row.biens!,
      gestionnaire: row.gestionnaires || null,
      contacts: [],
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDemandeById(id: number): Promise<DemandeWithRelations | undefined> {
    const rows = await db
      .select()
      .from(demandes)
      .leftJoin(biens, eq(demandes.bienId, biens.id))
      .leftJoin(gestionnaires, eq(demandes.gestionnaireId, gestionnaires.id))
      .where(eq(demandes.id, id));

    if (rows.length === 0) return undefined;

    const demandeContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.demandeId, id))
      .orderBy(contacts.id);

    return {
      ...rows[0].demandes,
      bien: rows[0].biens!,
      gestionnaire: rows[0].gestionnaires || null,
      contacts: demandeContacts,
    };
  }

  async createDemande(demande: InsertDemande): Promise<Demande> {
    const [created] = await db.insert(demandes).values(demande).returning();
    return created;
  }

  async updateDemande(id: number, updates: UpdateDemande): Promise<Demande | undefined> {
    const [updated] = await db
      .update(demandes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(demandes.id, id))
      .returning();
    return updated || undefined;
  }

  async getEmailLogs(page: number, limit: number, statuts?: string[]): Promise<PaginatedResponse<EmailLog>> {
    const offset = (page - 1) * limit;
    const whereClause = statuts && statuts.length > 0
      ? inArray(emailLogs.statut, statuts)
      : sql`1=1`;

    const [totalResult] = await db.select({ count: count() }).from(emailLogs).where(whereClause);
    const total = totalResult?.count ?? 0;

    const rows = await db
      .select()
      .from(emailLogs)
      .where(whereClause)
      .orderBy(desc(emailLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createEmailLog(logEntry: InsertEmailLog): Promise<EmailLog> {
    const [created] = await db.insert(emailLogs).values(logEntry).returning();
    return created;
  }

  async getEmailLogByDemande(demandeId: number): Promise<EmailLog | undefined> {
    const [log] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.demandeId, demandeId))
      .limit(1);
    return log;
  }

  async emailLogExists(messageId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(eq(emailLogs.messageId, messageId))
      .limit(1);
    return !!row;
  }

  async getDocumentsByDemande(demandeId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.demandeId, demandeId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return doc || undefined;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    return result.length > 0;
  }

  async getContacts(page: number, limit: number, qualite?: string, search?: string): Promise<PaginatedResponse<ContactWithDemande>> {
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof sql>[] = [];
    if (qualite) {
      conditions.push(sql`${contacts.qualite} = ${qualite}`);
    }
    if (search) {
      conditions.push(sql`(${contacts.nom} ILIKE ${'%' + search + '%'} OR ${contacts.telephone} ILIKE ${'%' + search + '%'})`);
    }

    const whereClause = conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : sql`1=1`;

    const [totalResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const rows = await db
      .select()
      .from(contacts)
      .leftJoin(demandes, eq(contacts.demandeId, demandes.id))
      .where(whereClause)
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    const data: ContactWithDemande[] = rows.map((row) => ({
      ...row.contacts,
      demande: row.demandes || null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createContacts(contactList: InsertContact[]): Promise<Contact[]> {
    if (contactList.length === 0) return [];
    const created = await db.insert(contacts).values(contactList).returning();
    return created;
  }

  async reassignGestionnaires(): Promise<{ demandesUpdated: number; biensUpdated: number; unmatched: string[] }> {
    const allGestionnaires = await db.select().from(gestionnaires);

    function normalizeName(name: string): string {
      return name
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function findBestGestionnaire(syndicName: string): { gestionnaire: typeof allGestionnaires[0]; score: number } | null {
      const normalizedSyndic = normalizeName(syndicName);
      const syndicTokens = normalizedSyndic.split(" ").filter(Boolean);

      let best: { gestionnaire: typeof allGestionnaires[0]; score: number } | null = null;

      for (const g of allGestionnaires) {
        const normalizedG = normalizeName(g.nom);
        const gTokens = normalizedG.split(" ").filter(Boolean);

        let matchCount = 0;
        for (const ta of syndicTokens) {
          if (gTokens.some((tb) => tb === ta || tb.includes(ta) || ta.includes(tb))) {
            matchCount++;
          }
        }
        const score = matchCount / Math.max(syndicTokens.length, gTokens.length);

        if (!best || score > best.score) {
          best = { gestionnaire: g, score };
        }
      }

      return best;
    }

    const orphanedDemandes = await db
      .select()
      .from(demandes)
      .where(and(isNull(demandes.gestionnaireId), sql`${demandes.commentaire} LIKE '%Syndic:%'`));

    let demandesUpdated = 0;
    const unmatched: string[] = [];
    const syndicCache = new Map<string, number | null>();

    for (const demande of orphanedDemandes) {
      if (!demande.commentaire) continue;
      const match = demande.commentaire.match(/Syndic:\s*(.+)/);
      if (!match) continue;
      const syndicName = match[1].trim();

      if (!syndicCache.has(syndicName)) {
        const best = findBestGestionnaire(syndicName);
        if (best && best.score >= 0.65) {
          syndicCache.set(syndicName, best.gestionnaire.id);
        } else {
          syndicCache.set(syndicName, null);
          if (!unmatched.includes(syndicName)) {
            unmatched.push(syndicName);
          }
        }
      }

      const gestionnaireId = syndicCache.get(syndicName);
      if (gestionnaireId !== null && gestionnaireId !== undefined) {
        await db
          .update(demandes)
          .set({ gestionnaireId })
          .where(eq(demandes.id, demande.id));
        demandesUpdated++;
      } else if (!unmatched.includes(syndicName)) {
        unmatched.push(syndicName);
      }
    }

    const orphanedBiens = await db
      .select()
      .from(biens)
      .where(isNull(biens.gestionnaireId));

    let biensUpdated = 0;

    for (const bien of orphanedBiens) {
      const linkedDemandes = await db
        .select({ gestionnaireId: demandes.gestionnaireId })
        .from(demandes)
        .where(and(eq(demandes.bienId, bien.id), sql`${demandes.gestionnaireId} IS NOT NULL`));

      if (linkedDemandes.length === 0) continue;

      const counts = new Map<number, number>();
      for (const d of linkedDemandes) {
        if (d.gestionnaireId !== null) {
          counts.set(d.gestionnaireId, (counts.get(d.gestionnaireId) ?? 0) + 1);
        }
      }

      let bestGestionnaireId: number | null = null;
      let bestCount = 0;
      for (const [gId, cnt] of Array.from(counts.entries())) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestGestionnaireId = gId;
        }
      }

      if (bestGestionnaireId !== null) {
        await db
          .update(biens)
          .set({ gestionnaireId: bestGestionnaireId })
          .where(eq(biens.id, bien.id));
        biensUpdated++;
      }
    }

    return { demandesUpdated, biensUpdated, unmatched };
  }
}

export const storage = new DatabaseStorage();
