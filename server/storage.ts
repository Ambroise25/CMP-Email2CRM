import {
  type Bien,
  type InsertBien,
  type UpdateBien,
  type BienWithGestionnaire,
  type BienMatch,
  type Gestionnaire,
  type InsertGestionnaire,
  type Demande,
  type InsertDemande,
  type UpdateDemande,
  type DemandeWithRelations,
  type PaginatedResponse,
  biens,
  gestionnaires,
  demandes,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, count } from "drizzle-orm";

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
  getBiens(page: number, limit: number, search?: string): Promise<PaginatedResponse<BienWithGestionnaire>>;
  getBienById(id: number): Promise<BienWithGestionnaire | undefined>;
  createBien(bien: InsertBien): Promise<Bien>;
  updateBien(id: number, bien: UpdateBien): Promise<Bien | undefined>;
  searchBiens(adresse: string, codePostal: string): Promise<{ matches: BienMatch[]; best_match: BienMatch | null }>;
  getGestionnaires(): Promise<Gestionnaire[]>;
  getGestionnaireById(id: number): Promise<Gestionnaire | undefined>;
  createGestionnaire(gestionnaire: InsertGestionnaire): Promise<Gestionnaire>;
  getDemandes(page: number, limit: number, filters?: { bienId?: number; etat?: string; metier?: string }): Promise<PaginatedResponse<DemandeWithRelations>>;
  getDemandeById(id: number): Promise<DemandeWithRelations | undefined>;
  createDemande(demande: InsertDemande): Promise<Demande>;
  updateDemande(id: number, updates: UpdateDemande): Promise<Demande | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getBiens(page: number, limit: number, search?: string): Promise<PaginatedResponse<BienWithGestionnaire>> {
    const offset = (page - 1) * limit;

    const whereClause = search
      ? sql`(${biens.adresse} ILIKE ${'%' + search + '%'} OR ${biens.ville} ILIKE ${'%' + search + '%'} OR ${biens.codePostal} ILIKE ${'%' + search + '%'})`
      : sql`1=1`;

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
      gestionnaire: row.gestionnaires!,
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
      gestionnaire: rows[0].gestionnaires!,
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
          bien: { ...row.biens, gestionnaire: row.gestionnaires! },
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

  async getGestionnaireById(id: number): Promise<Gestionnaire | undefined> {
    const [g] = await db.select().from(gestionnaires).where(eq(gestionnaires.id, id));
    return g || undefined;
  }

  async createGestionnaire(gestionnaire: InsertGestionnaire): Promise<Gestionnaire> {
    const [created] = await db.insert(gestionnaires).values(gestionnaire).returning();
    return created;
  }

  async getDemandes(page: number, limit: number, filters?: { bienId?: number; etat?: string; metier?: string }): Promise<PaginatedResponse<DemandeWithRelations>> {
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
      gestionnaire: row.gestionnaires!,
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

    return {
      ...rows[0].demandes,
      bien: rows[0].biens!,
      gestionnaire: rows[0].gestionnaires!,
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
}

export const storage = new DatabaseStorage();
