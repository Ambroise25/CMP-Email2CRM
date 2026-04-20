import { db } from "../db";
import { gestionnaires, biens, demandes } from "../../shared/schema";
import { inArray } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // 1. Récupérer tous les IDs existants
  const existing = await db.select({ id: gestionnaires.id }).from(gestionnaires);
  const existingIds = existing.map((g) => g.id);

  if (existingIds.length > 0) {
    // Nullifier les FK avant suppression (contrainte NO ACTION)
    await db.update(biens).set({ gestionnaireId: null }).where(inArray(biens.gestionnaireId, existingIds));
    await db.update(demandes).set({ gestionnaireId: null }).where(inArray(demandes.gestionnaireId, existingIds));
    await db.delete(gestionnaires).where(inArray(gestionnaires.id, existingIds));
    console.log(`Supprimé ${existingIds.length} gestionnaire(s) existant(s).`);
  } else {
    console.log("Aucun gestionnaire existant à supprimer.");
  }

  // 2. Parser le CSV
  const csvPath = path.join(
    process.cwd(),
    "attached_assets/client_entreprises-export-2026-04-15_17-40-50_1776669666474.csv"
  );
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").slice(1); // Ignorer l'entête

  const seenNames = new Set<string>();
  let inserted = 0;
  let skippedMasque = 0;
  let skippedDuplicate = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    const cols = line.split(";");
    const nom_raw = cols[2]?.trim() ?? "";
    const adresse_raw = cols[3]?.trim() || null;
    const masque = cols[8]?.trim();
    const nom_affiche = cols[9]?.trim();

    if (!nom_raw) continue;

    // Exclure les particuliers masqués
    if (masque === "true") {
      skippedMasque++;
      continue;
    }

    // Utiliser nom_affiche si défini
    const nom = nom_affiche || nom_raw;

    // Dédoublonner par nom (insensible à la casse)
    const key = nom.toLowerCase();
    if (seenNames.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seenNames.add(key);

    await db.insert(gestionnaires).values({
      nom,
      adresse: adresse_raw,
      email: null,
      telephone: null,
    });
    inserted++;
  }

  console.log(`\nImport terminé :`);
  console.log(`  ${inserted} gestionnaires importés`);
  console.log(`  ${skippedMasque} ignorés (masque=true)`);
  console.log(`  ${skippedDuplicate} ignorés (doublons)`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur lors de l'import :", e);
  process.exit(1);
});
