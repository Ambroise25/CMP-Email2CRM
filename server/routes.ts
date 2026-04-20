import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBienSchema, updateBienSchema, searchBienSchema, insertDemandeSchema, updateDemandeSchema, insertGestionnaireSchema, updateGestionnaireSchema, ETATS, METIERS, CONTACT_QUALITES } from "@shared/schema";
import { ZodError, z } from "zod";
import { emailServiceState, triggerManualSync, parseEmailWithLLM } from "./email-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/biens/search", async (req, res) => {
    try {
      const parsed = searchBienSchema.safeParse({
        adresse: req.query.adresse,
        code_postal: req.query.code_postal,
      });

      if (!parsed.success) {
        return res.status(400).json({
          error: "Parametres de recherche invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await storage.searchBiens(parsed.data.adresse, parsed.data.code_postal);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/biens", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = (req.query.search as string) || undefined;
      const sansGestionnaire = req.query.sans_gestionnaire === "1";

      const result = await storage.getBiens(page, limit, search, sansGestionnaire);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/biens/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const bien = await storage.getBienById(id);
      if (!bien) {
        return res.status(404).json({ error: "Bien non trouve" });
      }

      return res.json(bien);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/biens", async (req, res) => {
    try {
      const parsed = insertBienSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      if (parsed.data.gestionnaireId != null) {
        if (parsed.data.gestionnaireId <= 0) {
          return res.status(400).json({
            error: "Donnees invalides",
            details: { gestionnaireId: ["L'identifiant du gestionnaire doit etre positif"] },
          });
        }
        const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
        if (!gestionnaire) {
          return res.status(400).json({
            error: "Gestionnaire non trouve",
            details: { gestionnaireId: ["Le gestionnaire specifie n'existe pas"] },
          });
        }
      }

      const bien = await storage.createBien(parsed.data);
      return res.status(201).json(bien);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/biens/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const existing = await storage.getBienById(id);
      if (!existing) {
        return res.status(404).json({ error: "Bien non trouve" });
      }

      const parsed = updateBienSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      if (parsed.data.gestionnaireId != null) {
        if (parsed.data.gestionnaireId <= 0) {
          return res.status(400).json({
            error: "Donnees invalides",
            details: { gestionnaireId: ["L'identifiant du gestionnaire doit etre positif"] },
          });
        }
        const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
        if (!gestionnaire) {
          return res.status(400).json({
            error: "Gestionnaire non trouve",
            details: { gestionnaireId: ["Le gestionnaire specifie n'existe pas"] },
          });
        }
      }

      const updated = await storage.updateBien(id, parsed.data);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/gestionnaires", async (_req, res) => {
    try {
      const list = await storage.getGestionnairesWithBienCount();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/gestionnaires", async (req, res) => {
    try {
      const parsed = insertGestionnaireSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const gestionnaire = await storage.createGestionnaire(parsed.data);
      return res.status(201).json(gestionnaire);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/gestionnaires/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const existing = await storage.getGestionnaireById(id);
      if (!existing) {
        return res.status(404).json({ error: "Gestionnaire non trouve" });
      }

      const parsed = updateGestionnaireSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await storage.updateGestionnaire(id, parsed.data);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/gestionnaires/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const existing = await storage.getGestionnaireById(id);
      if (!existing) {
        return res.status(404).json({ error: "Gestionnaire non trouve" });
      }

      const bienCount = await storage.countBiensByGestionnaire(id);

      const reassignTo = req.body?.reassignTo !== undefined && req.body?.reassignTo !== null
        ? parseInt(req.body.reassignTo)
        : undefined;

      if (bienCount > 0 && reassignTo === undefined) {
        return res.status(400).json({
          error: "Ce gestionnaire a des biens rattaches. Fournissez reassignTo pour les transferer.",
          bienCount,
        });
      }

      if (reassignTo !== undefined) {
        if (isNaN(reassignTo)) {
          return res.status(400).json({ error: "reassignTo invalide" });
        }
        if (reassignTo === id) {
          return res.status(400).json({ error: "reassignTo ne peut pas etre le meme gestionnaire" });
        }
        const target = await storage.getGestionnaireById(reassignTo);
        if (!target) {
          return res.status(400).json({ error: "Gestionnaire de reassignation non trouve" });
        }
      }

      const result = await storage.deleteGestionnaire(id, reassignTo);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/gestionnaires/:id/biens-count", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      const count = await storage.countBiensByGestionnaire(id);
      return res.json({ count });
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/demandes", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const filters: { bienId?: number; etat?: string; metier?: string; excludeNouvelle?: boolean } = {};

      if (req.query.bien_id) {
        filters.bienId = parseInt(req.query.bien_id as string);
        if (isNaN(filters.bienId)) {
          return res.status(400).json({ error: "bien_id invalide" });
        }
      }
      if (req.query.etat) {
        const etat = req.query.etat as string;
        if (!ETATS.includes(etat as any)) {
          return res.status(400).json({ error: "Etat invalide", etats_valides: ETATS });
        }
        filters.etat = etat;
      }
      if (req.query.metier) {
        const metier = req.query.metier as string;
        if (!METIERS.includes(metier as any)) {
          return res.status(400).json({ error: "Metier invalide", metiers_valides: METIERS });
        }
        filters.metier = metier;
      }
      if (req.query.exclude_nouvelle === "true") {
        filters.excludeNouvelle = true;
      }

      const result = await storage.getDemandes(page, limit, filters);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/demandes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const demande = await storage.getDemandeById(id);
      if (!demande) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      return res.json(demande);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/demandes", async (req, res) => {
    try {
      const parsed = insertDemandeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const bien = await storage.getBienById(parsed.data.bienId);
      if (!bien) {
        return res.status(400).json({ error: "Bien non trouve" });
      }

      if (parsed.data.gestionnaireId != null) {
        if (parsed.data.gestionnaireId <= 0) {
          return res.status(400).json({ error: "Identifiant gestionnaire invalide" });
        }
        const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
        if (!gestionnaire) {
          return res.status(400).json({ error: "Gestionnaire non trouve" });
        }
      }

      const demande = await storage.createDemande(parsed.data);
      return res.status(201).json(demande);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/demandes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const existing = await storage.getDemandeById(id);
      if (!existing) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      const parsed = updateDemandeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Donnees invalides",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      if (parsed.data.bienId) {
        const bien = await storage.getBienById(parsed.data.bienId);
        if (!bien) {
          return res.status(400).json({ error: "Bien non trouve" });
        }
      }

      if (parsed.data.gestionnaireId != null) {
        if (parsed.data.gestionnaireId <= 0) {
          return res.status(400).json({ error: "Identifiant gestionnaire invalide" });
        }
        const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
        if (!gestionnaire) {
          return res.status(400).json({ error: "Gestionnaire non trouve" });
        }
      }

      const updated = await storage.updateDemande(id, parsed.data);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  const ALLOWED_MIME_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
    "application/octet-stream",
  ];
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  app.get("/api/demandes/:id/email", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const log = await storage.getEmailLogByDemande(id);
      if (!log) {
        return res.status(404).json({ error: "Aucun email associé à cette demande" });
      }

      return res.json(log);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/demandes/:id/reparse", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const demande = await storage.getDemandeById(id);
      if (!demande) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      const emailLog = await storage.getEmailLogByDemande(id);
      if (!emailLog) {
        return res.status(400).json({ error: "Aucun email source associé à cette demande" });
      }

      const parsed = await parseEmailWithLLM(emailLog.body || "", emailLog.subject, emailLog.from);
      if (!parsed) {
        return res.status(502).json({ error: "Le parsing LLM a échoué, veuillez réessayer" });
      }

      const champsManquantsList: string[] = [];
      if (!parsed.bien?.adresse) champsManquantsList.push("adresse");
      if (!parsed.bien?.code_postal) champsManquantsList.push("code postal");
      if (!parsed.demande?.objet) champsManquantsList.push("objet");

      const infoManquantes = champsManquantsList.length > 0;

      const updated = await storage.updateDemande(id, {
        objet: (parsed.demande?.objet || demande.objet).slice(0, 200),
        detail: parsed.demande?.detail || demande.detail,
        refSyndic: parsed.demande?.ref_syndic || demande.refSyndic,
        infoManquantes,
        champsManquants: infoManquantes ? champsManquantsList.join(", ") : null,
      });

      const freshContacts = (parsed.contacts || [])
        .filter((c) => c.nom || c.telephone || c.email)
        .map((c) => ({
          demandeId: id,
          nom: c.nom || null,
          telephone: c.telephone || null,
          email: c.email || null,
          qualite: CONTACT_QUALITES.includes(c.qualite as typeof CONTACT_QUALITES[number])
            ? (c.qualite as string)
            : "autre",
          autoGenerated: true,
        }));
      await storage.replaceContactsByDemande(id, freshContacts);

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/demandes/:id/contacts", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const demande = await storage.getDemandeById(id);
      if (!demande) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      const { nom, telephone, email, qualite } = req.body;
      if (!nom && !telephone && !email) {
        return res.status(400).json({ error: "Au moins un champ (nom, téléphone, email) est requis" });
      }

      const [created] = await storage.createContacts([{
        demandeId: id,
        nom: nom || null,
        telephone: telephone || null,
        email: email || null,
        qualite: CONTACT_QUALITES.includes(qualite as typeof CONTACT_QUALITES[number]) ? qualite : "autre",
        autoGenerated: false,
      }]);

      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const deleted = await storage.deleteContact(id);
      if (!deleted) {
        return res.status(404).json({ error: "Contact non trouvé" });
      }

      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/demandes/:id/documents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const demande = await storage.getDemandeById(id);
      if (!demande) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      const docs = await storage.getDocumentsByDemande(id);
      const metadata = docs.map(({ data, ...rest }) => ({ ...rest, size: Math.round((data.length * 3) / 4) }));
      return res.json(metadata);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const doc = await storage.getDocumentById(id);
      if (!doc) {
        return res.status(404).json({ error: "Document non trouve" });
      }

      const buffer = Buffer.from(doc.data, "base64");
      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.nom)}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/demandes/:id/documents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const demande = await storage.getDemandeById(id);
      if (!demande) {
        return res.status(404).json({ error: "Demande non trouvee" });
      }

      const { nom, mimeType, data } = req.body;
      if (!nom || !mimeType || !data) {
        return res.status(400).json({ error: "Champs nom, mimeType et data requis" });
      }

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: "Type de fichier non autorisé" });
      }

      const estimatedBytes = Math.round((data.length * 3) / 4);
      if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ error: `Fichier trop volumineux (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo)` });
      }

      const doc = await storage.createDocument({ demandeId: id, nom, mimeType, data });
      const { data: _data, ...metadata } = doc;
      return res.status(201).json({ ...metadata, size: estimatedBytes });
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const deleted = await storage.deleteDocument(id);
      if (!deleted) {
        return res.status(404).json({ error: "Document non trouve" });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/contacts", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const qualiteParam = req.query.qualite as string | undefined;
      const search = (req.query.search as string) || undefined;

      if (qualiteParam && !CONTACT_QUALITES.includes(qualiteParam as typeof CONTACT_QUALITES[number])) {
        return res.status(400).json({ error: "Qualité invalide", qualites_valides: CONTACT_QUALITES });
      }

      const result = await storage.getContacts(page, limit, qualiteParam || undefined, search);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/emails/logs", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const statutParam = req.query.statut as string | undefined;
      const statuts = statutParam ? statutParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const result = await storage.getEmailLogs(page, limit, statuts);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/emails/status", async (_req, res) => {
    return res.json({
      enabled: emailServiceState.enabled,
      intervalMs: emailServiceState.intervalMs,
      lastCheck: emailServiceState.lastCheck,
      nextCheck: emailServiceState.nextCheck,
      lastError: emailServiceState.lastError,
    });
  });

  app.post("/api/emails/sync", async (_req, res) => {
    try {
      const result = await triggerManualSync();
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post("/api/admin/reassign-gestionnaires", async (_req, res) => {
    try {
      const result = await storage.reassignGestionnaires();
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post("/api/admin/import-syndics", async (req, res) => {
    try {
      const { names } = z.object({ names: z.array(z.string()) }).parse(req.body);

      const allGestionnaires = await storage.getGestionnaires();
      const existingNames = new Set(allGestionnaires.map((g) => g.nom.trim().toLowerCase()));

      let created = 0;
      let skipped = 0;
      let invalid = 0;

      for (const raw of names) {
        const trimmed = raw.trim();
        if (!trimmed) {
          invalid++;
          continue;
        }
        const key = trimmed.toLowerCase();
        if (existingNames.has(key)) {
          skipped++;
          continue;
        }
        await storage.createGestionnaire({ nom: trimmed });
        existingNames.add(key);
        created++;
      }

      return res.json({ success: true, created, skipped, invalid });
    } catch (err) {
      return res.status(400).json({ success: false, error: String(err) });
    }
  });

  return httpServer;
}
