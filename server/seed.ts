import { db } from "./db";
import { gestionnaires, biens } from "@shared/schema";
import { count } from "drizzle-orm";

export async function seedDatabase() {
  const [gestionnaireCount] = await db.select({ count: count() }).from(gestionnaires);
  if (gestionnaireCount.count > 0) return;

  const insertedGestionnaires = await db.insert(gestionnaires).values([
    { nom: "Cabinet Durand Immobilier", email: "contact@durand-immo.fr", telephone: "01 42 55 78 90" },
    { nom: "SCI Les Terrasses", email: "gestion@lesterrasses.fr", telephone: "01 39 22 14 56" },
    { nom: "Foncia Paris Est", email: "paris.est@foncia.fr", telephone: "01 48 77 33 21" },
    { nom: "Nexity Gestion", email: "gestion@nexity.fr", telephone: "01 55 89 44 10" },
    { nom: "Citya Immobilier", email: "contact@citya.com", telephone: "02 47 60 70 80" },
  ]).returning();

  await db.insert(biens).values([
    {
      adresse: "12 Rue des Econdeaux",
      complementAdresse: "Batiment A",
      codePostal: "93800",
      ville: "Epinay-sur-Seine",
      gestionnaireId: insertedGestionnaires[0].id,
      information: "Residence construite en 1975, 4 etages, ascenseur",
    },
    {
      adresse: "45 Avenue Jean Jaures",
      complementAdresse: null,
      codePostal: "93800",
      ville: "Epinay-sur-Seine",
      gestionnaireId: insertedGestionnaires[0].id,
      information: "Immeuble haussmannien, parking souterrain",
    },
    {
      adresse: "8 Boulevard de la Liberation",
      complementAdresse: "Escalier B, 3eme etage",
      codePostal: "93200",
      ville: "Saint-Denis",
      gestionnaireId: insertedGestionnaires[1].id,
      information: "Proche metro ligne 13",
    },
    {
      adresse: "23 Rue Victor Hugo",
      complementAdresse: null,
      codePostal: "75015",
      ville: "Paris",
      gestionnaireId: insertedGestionnaires[2].id,
      information: "Studio renove en 2020",
    },
    {
      adresse: "156 Avenue de la Republique",
      complementAdresse: "Appartement 42",
      codePostal: "75011",
      ville: "Paris",
      gestionnaireId: insertedGestionnaires[2].id,
      information: "T3 lumineux, balcon, vue degagee",
    },
    {
      adresse: "7 Place de la Mairie",
      complementAdresse: null,
      codePostal: "92100",
      ville: "Boulogne-Billancourt",
      gestionnaireId: insertedGestionnaires[3].id,
      information: "Local commercial en rez-de-chaussee",
    },
    {
      adresse: "34 Rue du Marechal Foch",
      complementAdresse: "Residence Les Lilas",
      codePostal: "94200",
      ville: "Ivry-sur-Seine",
      gestionnaireId: insertedGestionnaires[3].id,
      information: "T2 avec cave et place de parking",
    },
    {
      adresse: "91 Boulevard Haussmann",
      complementAdresse: "6eme etage droite",
      codePostal: "75008",
      ville: "Paris",
      gestionnaireId: insertedGestionnaires[4].id,
      information: "Appartement de standing, gardien",
    },
  ]);

  console.log("Database seeded with sample data");
}
