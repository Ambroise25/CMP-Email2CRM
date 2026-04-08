import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBienSchema, updateBienSchema, searchBienSchema, insertDemandeSchema, updateDemandeSchema, ETATS, METIERS } from "@shared/schema";
import { ZodError } from "zod";
import { emailServiceState, triggerManualSync } from "./email-service";

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

      const result = await storage.getBiens(page, limit, search);
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

      const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
      if (!gestionnaire) {
        return res.status(400).json({
          error: "Gestionnaire non trouve",
          details: { gestionnaireId: ["Le gestionnaire specifie n'existe pas"] },
        });
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

      if (parsed.data.gestionnaireId) {
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
      const list = await storage.getGestionnaires();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/demandes", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const filters: { bienId?: number; etat?: string; metier?: string } = {};

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

      const gestionnaire = await storage.getGestionnaireById(parsed.data.gestionnaireId);
      if (!gestionnaire) {
        return res.status(400).json({ error: "Gestionnaire non trouve" });
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

      if (parsed.data.gestionnaireId) {
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

  return httpServer;
}
