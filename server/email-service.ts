import Imap from "imap";
import { simpleParser, type ParsedMail } from "mailparser";
import OpenAI from "openai";
import { storage } from "./storage";
import { CONTACT_QUALITES } from "@shared/schema";
import { log } from "./index";

const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_POLL_INTERVAL_MS || "300000", 10);
const IMAP_FOLDER_INBOX = process.env.IMAP_FOLDER || "INBOX";
const IMAP_FOLDER_ARCHIVE = process.env.IMAP_FOLDER_ARCHIVE || "Email traite";
const IMAP_FOLDER_ERRORS = process.env.IMAP_FOLDER_ERRORS || "Erreurs";
const IMAP_FOLDER_AUTRES = process.env.IMAP_FOLDER_AUTRES || "Autre Emails";

const SKIP_SENDERS = [
  "no-reply@accounts.google.com",
  "noreply@google.com",
  "mailer-daemon@",
  "postmaster@",
];

const SKIP_SUBJECTS_KEYWORDS = [
  "alerte de sécurité",
  "security alert",
  "connexion depuis",
  "sign-in from",
  "verify your email",
  "vérifiez votre",
];

const INTERVENTION_KEYWORDS = [
  "ordre de service", "os n°", "os n ", "o.s.",
  "demande d'intervention", "demande intervention",
  "demande de devis", "devis travaux",
  "sinistre", "dégât des eaux", "degat des eaux", "dégâts des eaux",
  "fuite", "infiltration", "inondation",
  "étanchéité", "etancheite", "toiture", "couverture",
  "plomberie", "canalisation",
  "intervention urgente", "intervention rapide",
  "bon de commande", "bon commande",
  "réparation", "reparation",
  "diagnostic", "expertise",
  "pissette", "acrotère", "membrane", "bitume",
  "terrasse", "balcon",
];

const NON_INTERVENTION_KEYWORDS = [
  "facture", "avoir n°", "relevé de compte",
  "newsletter", "se désabonner", "unsubscribe",
  "candidature", "cv en pièce jointe", "recrutement",
  "offre d'emploi", "poste à pourvoir",
  "confirmation de rendez-vous",
  "procès-verbal", "pv d'ag", "assemblée générale",
  "joyeux noël", "bonne année", "meilleurs voeux",
  "avis de virement", "relevé de compte", "accusé réception",
];

const CLASSIFICATION_PROMPT = `Tu es un filtre de tri pour une entreprise de travaux bâtiment (étanchéité, plomberie, couverture).

Analyse le sujet et le début du corps de cet email. Réponds UNIQUEMENT par "OUI" ou "NON".

Réponds "OUI" si c'est une DEMANDE D'INTERVENTION ou d'un DEVIS pour des travaux :
- Ordre de service (OS)
- Demande de devis travaux
- Signalement de sinistre, fuite, infiltration
- Demande d'intervention, réparation, diagnostic
- Transfert d'une demande d'intervention

Réponds "NON" si c'est :
- Facture, avoir, relevé de compte
- Newsletter, publicité, offre commerciale
- Email de recrutement, candidature
- Confirmation de rendez-vous déjà pris
- Notification système, alerte de sécurité
- Compte-rendu de réunion, PV d'AG
- Email administratif sans demande de travaux

Réponds UNIQUEMENT "OUI" ou "NON", rien d'autre.`;

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des donnees structurees depuis des emails de demande d'intervention batiment.

REGLES METIER:
- pissette, balcon, terrasse, eau pluviale, EP = Etancheite (PAS plomberie)
- WC, robinet, sanitaire, eau chaude = Plomberie
- tuile, ardoise, gouttiere = Autre
- electricite, tableau, disjoncteur = Electricite

REGLES URGENCE:
- "demande de devis" ou "devis" = Faible
- "fuite active", "sinistre", "urgent" = Urgent
- autres cas = Normal

DISTINCTION SYNDIC vs PRESTATAIRE:
- Le SYNDIC est le gestionnaire immobilier qui ENVOIE la demande (Foncia, Nexity, VertFoncié, Citya, Sergic, Oralia, ICS, etc.)
- Le PRESTATAIRE est l'entreprise qui RECOIT la demande pour faire les travaux (ENERPUR, entreprises d'étanchéité/plomberie/couverture)
- NE JAMAIS mettre le prestataire comme syndic!
- Indices syndic: adresse du syndic, nom du gestionnaire, logo en haut de page

Extrait TOUTES les infos du corps de l'email ET des pieces jointes. Reponds avec ce JSON:

{
  "bien": {"adresse": "...", "code_postal": "...", "ville": "...", "nom_copropriete": "..."},
  "demande": {"objet": "...", "detail": "...", "urgence": "Urgent|Normal|Faible", "ref_syndic": "..."},
  "contacts": [{"nom": "...", "telephone": "...", "email": "...", "qualite": "gardien|proprietaire|locataire|gestionnaire|conseil_syndical|autre"}],
  "codes_acces": "Digicode: ..., Interphone: ...",
  "syndic": "...",
  "gestionnaire": "...",
  "confiance": 0.9
}

IMPORTANT:
- Cherche les contacts (noms, telephones) dans tout le contenu.
- Le syndic n'est JAMAIS une entreprise de travaux (etancheite, plomberie, etc.)
- Pour qualite: "gestionnaire" = syndic/gestionnaire immobilier, "conseil_syndical" = membre du conseil syndical de la copropriété, "proprietaire" = propriétaire du lot, "locataire" = locataire occupant, "gardien" = gardien/concierge.
- Utilise null si absent. Reponds avec un JSON valide uniquement, sans markdown.`;


const MAX_BODY_CHARS = 10000;

let pollingTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

export const emailServiceState = {
  enabled: false,
  intervalMs: POLL_INTERVAL_MS,
  lastCheck: null as Date | null,
  nextCheck: null as Date | null,
  lastError: null as string | null,
};

function getOpenRouter(): OpenAI {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
  });
}

function getImapConfig() {
  return {
    user: process.env.GMAIL_USER || "",
    password: process.env.GMAIL_APP_PASSWORD || "",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 30000,
    authTimeout: 15000,
  };
}

function shouldSkipEmail(from: string, subject: string): boolean {
  const lowerFrom = from.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  if (SKIP_SENDERS.some((s) => lowerFrom.includes(s))) return true;
  if (SKIP_SUBJECTS_KEYWORDS.some((kw) => lowerSubject.includes(kw))) return true;
  return false;
}

function isInterventionEmailKeywords(subject: string, body: string): boolean {
  const combined = `${subject}\n${body.slice(0, 2000)}`.toLowerCase();
  for (const kw of NON_INTERVENTION_KEYWORDS) {
    if (combined.includes(kw)) return false;
  }
  for (const kw of INTERVENTION_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

async function isInterventionEmail(subject: string, body: string): Promise<boolean> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

  if (!baseUrl || !apiKey) {
    return isInterventionEmailKeywords(subject, body);
  }

  const truncatedBody = body.slice(0, 2000);
  const userContent = `Sujet: ${subject}\n\nCorps (début):\n${truncatedBody}`;

  try {
    const openrouter = getOpenRouter();
    const response = await openrouter.chat.completions.create({
      model: "mistralai/ministral-8b-2512",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 10,
      temperature: 0.0,
    });

    const answer = (response.choices[0]?.message?.content || "").trim().toUpperCase();
    if (answer.includes("OUI")) return true;
    if (answer.includes("NON")) return false;
    log(`Classification LLM ambiguë: "${answer}", fallback mots-clés`, "email-service");
    return isInterventionEmailKeywords(subject, body);
  } catch (err) {
    log(`Erreur classification LLM: ${err}, fallback mots-clés`, "email-service");
    return isInterventionEmailKeywords(subject, body);
  }
}

interface ParsedEmailData {
  bien: {
    adresse: string | null;
    code_postal: string | null;
    ville: string | null;
    nom_copropriete: string | null;
  } | null;
  demande: {
    objet: string | null;
    detail: string | null;
    urgence: string | null;
    ref_syndic: string | null;
  } | null;
  contacts: Array<{
    nom: string | null;
    telephone: string | null;
    email: string | null;
    qualite: string | null;
  }>;
  codes_acces: string | null;
  gestionnaire: string | null;
  syndic: string | null;
  confiance: number;
}

export async function parseEmailWithLLM(
  body: string,
  subject: string,
  from: string
): Promise<ParsedEmailData | null> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

  if (!baseUrl || !apiKey) {
    log("OpenRouter non configuré, parsing LLM impossible", "email-service");
    return null;
  }

  const openrouter = getOpenRouter();
  const truncatedBody = body.slice(0, MAX_BODY_CHARS);

  const userPrompt = `Email recu:
---
De: ${from}
Sujet: ${subject}

${truncatedBody}
---

Reponds avec un JSON valide uniquement.`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openrouter.chat.completions.create({
        model: "mistralai/ministral-8b-2512",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || "";
      let cleaned = content.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log(`Réponse LLM invalide (tentative ${attempt}): ${content.slice(0, 200)}`, "email-service");
        continue;
      }

      return JSON.parse(jsonMatch[0]) as ParsedEmailData;
    } catch (err) {
      log(`Erreur parsing LLM tentative ${attempt}: ${err}`, "email-service");
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return null;
}

interface RawEmail {
  uid: number;
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  body: string;
}

function fetchUnreadEmails(): Promise<RawEmail[]> {
  return new Promise((resolve, reject) => {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      return reject(new Error("GMAIL_USER et GMAIL_APP_PASSWORD non configurés"));
    }

    const imap = new Imap({
      ...getImapConfig(),
      user: gmailUser,
      password: gmailPassword,
    });

    const results: RawEmail[] = [];

    imap.once("ready", () => {
      imap.openBox(IMAP_FOLDER_INBOX, false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.search(["UNSEEN"], (err, uids) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!uids || uids.length === 0) {
            imap.end();
            return resolve([]);
          }

          const sorted = [...uids].sort((a, b) => b - a);
          const slice = sorted.slice(0, 20);

          const fetch = imap.fetch(slice, { bodies: "", markSeen: false });
          let pending = slice.length;

          fetch.on("message", (msg, seqno) => {
            const buffers: Buffer[] = [];
            let uid = 0;

            msg.on("attributes", (attrs) => {
              uid = attrs.uid;
            });

            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => buffers.push(chunk));
              stream.once("end", async () => {
                try {
                  const raw = Buffer.concat(buffers);
                  const parsed: ParsedMail = await simpleParser(raw);
                  const messageId = parsed.messageId || `uid-${uid}-${Date.now()}`;
                  const from = parsed.from?.text || "";
                  const subject = parsed.subject || "(sans objet)";
                  const date = parsed.date || new Date();
                  const htmlText = typeof parsed.html === "string"
                    ? parsed.html.replace(/<[^>]+>/g, " ")
                    : "";
                  const body = parsed.text || htmlText || "";

                  results.push({ uid: uid || seqno, messageId, from, subject, date, body });
                } catch (parseErr) {
                  log(`Erreur parsing email: ${parseErr}`, "email-service");
                } finally {
                  pending--;
                  if (pending === 0) {
                    imap.end();
                    resolve(results);
                  }
                }
              });
            });
          });

          fetch.once("error", (err) => {
            imap.end();
            reject(err);
          });

          fetch.once("end", () => {
            if (pending === 0) resolve(results);
          });
        });
      });
    });

    imap.once("error", (err: Error) => reject(err));
    imap.once("end", () => resolve(results));
    imap.connect();
  });
}

function moveEmailToImapFolder(uid: number, targetFolder: string): Promise<void> {
  return new Promise((resolve) => {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      log(`Archivage impossible: GMAIL_USER/PASSWORD non configurés`, "email-service");
      return resolve();
    }

    const imap = new Imap({
      ...getImapConfig(),
      user: gmailUser,
      password: gmailPassword,
    });

    const doMove = () => {
      imap.copy([uid], targetFolder, (copyErr) => {
        if (copyErr) {
          log(`Archivage: erreur copie vers "${targetFolder}": ${copyErr}`, "email-service");
          imap.end();
          return resolve();
        }
        imap.addFlags([uid], "\\Deleted", () => {
          imap.expunge(() => {
            imap.end();
            log(`Email UID=${uid} archivé vers "${targetFolder}"`, "email-service");
            resolve();
          });
        });
      });
    };

    imap.once("ready", () => {
      imap.openBox(IMAP_FOLDER_INBOX, false, (err) => {
        if (err) {
          log(`Archivage: erreur ouverture INBOX: ${err}`, "email-service");
          imap.end();
          return resolve();
        }

        imap.openBox(targetFolder, false, (err2) => {
          const backToInboxAndMove = () => {
            imap.openBox(IMAP_FOLDER_INBOX, false, (err3) => {
              if (err3) { imap.end(); return resolve(); }
              doMove();
            });
          };

          if (!err2) {
            backToInboxAndMove();
          } else {
            imap.addBox(targetFolder, (createErr) => {
              if (createErr) {
                log(`Archivage: impossible de créer "${targetFolder}": ${createErr}`, "email-service");
                imap.end();
                return resolve();
              }
              backToInboxAndMove();
            });
          }
        });
      });
    });

    imap.once("error", (err: Error) => {
      log(`Archivage: erreur IMAP: ${err}`, "email-service");
      resolve();
    });

    imap.connect();
  });
}

function markEmailAsSeen(uid: number): Promise<void> {
  return new Promise((resolve) => {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      return resolve();
    }

    const imap = new Imap({
      ...getImapConfig(),
      user: gmailUser,
      password: gmailPassword,
    });

    imap.once("ready", () => {
      imap.openBox(IMAP_FOLDER_INBOX, false, (err) => {
        if (err) {
          imap.end();
          return resolve();
        }
        imap.addFlags([uid], "\\Seen", () => {
          imap.end();
          resolve();
        });
      });
    });

    imap.once("error", () => resolve());
    imap.connect();
  });
}

async function processEmails(): Promise<{ processed: number; errors: number; ignored: number }> {
  if (isProcessing) {
    log("Déjà en cours de traitement, skip", "email-service");
    return { processed: 0, errors: 0, ignored: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let errors = 0;
  let ignored = 0;

  try {
    log("Lecture des emails non lus...", "email-service");
    const emails = await fetchUnreadEmails();
    log(`${emails.length} email(s) non lu(s) trouvé(s)`, "email-service");

    for (const email of emails) {
      try {
        const alreadyProcessed = await storage.emailLogExists(email.messageId);
        if (alreadyProcessed) {
          log(`Email déjà traité: ${email.messageId}`, "email-service");
          continue;
        }

        if (shouldSkipEmail(email.from, email.subject)) {
          log(`Email ignoré (notification système), déplacé vers "${IMAP_FOLDER_AUTRES}": ${email.subject}`, "email-service");
          await moveEmailToImapFolder(email.uid, IMAP_FOLDER_AUTRES);
          ignored++;
          continue;
        }

        log(`Classification email: "${email.subject}"`, "email-service");
        const isIntervention = await isInterventionEmail(email.subject, email.body);

        if (!isIntervention) {
          log(`Email non pertinent, déplacé vers "${IMAP_FOLDER_AUTRES}": ${email.subject}`, "email-service");
          await moveEmailToImapFolder(email.uid, IMAP_FOLDER_AUTRES);
          ignored++;
          continue;
        }

        await markEmailAsSeen(email.uid);
        log(`Parsing email: "${email.subject}" de ${email.from}`, "email-service");
        const parsed = await parseEmailWithLLM(email.body, email.subject, email.from);

        if (!parsed) {
          await storage.createEmailLog({
            messageId: email.messageId,
            receivedAt: email.date,
            from: email.from,
            subject: email.subject,
            body: email.body || null,
            statut: "erreur",
            demandeId: null,
            erreur: "Parsing LLM échoué ou réponse invalide",
            rawParsed: null,
          });
          await moveEmailToImapFolder(email.uid, IMAP_FOLDER_ERRORS);
          errors++;
          continue;
        }

        const adresse = parsed.bien?.adresse;
        const codePostal = parsed.bien?.code_postal;
        const objet = parsed.demande?.objet;
        const urgence = parsed.demande?.urgence || "Normal";
        const contacts = parsed.contacts || [];
        const codesAcces = parsed.codes_acces;

        const champsManquantsList: string[] = [];
        if (!adresse) champsManquantsList.push("adresse");
        if (!codePostal) champsManquantsList.push("code postal");
        if (!objet) champsManquantsList.push("objet");

        const infoManquantes = champsManquantsList.length > 0;

        if (infoManquantes) {
          log(
            `Données partielles (manquants: ${champsManquantsList.join(", ")}) — création de la demande avec valeurs de repli`,
            "email-service"
          );
        }

        const adresseEffective = adresse || "À compléter";
        const codePostalEffectif = codePostal || "À compléter";
        const objetEffectif = objet || "À compléter";

        let demandeId: number | null = null;
        let createErreur: string | null = null;

        try {
          const searchResult = await storage.searchBiens(adresseEffective, codePostalEffectif);
          const bestMatch = searchResult.best_match;

          let bienId: number | null = null;
          let gestionnaireId: number | null = null;

          if (bestMatch && bestMatch.score >= 0.5) {
            bienId = bestMatch.bien.id;
            gestionnaireId = bestMatch.bien.gestionnaire?.id || null;
            log(`Bien trouvé: ID=${bienId} (score=${bestMatch.score})`, "email-service");
          } else {
            let resolvedGestionnaireId: number | null = null;
            if (parsed.syndic) {
              const gestionnaireContact = parsed.contacts?.find(c => c.qualite === "gestionnaire");
              const gestionnaireEmail = gestionnaireContact?.email || null;
              const gestionnaireTel = gestionnaireContact?.telephone || null;
              const g = await storage.findOrCreateGestionnaire(parsed.syndic, gestionnaireEmail, gestionnaireTel);
              resolvedGestionnaireId = g.id;
              log(`Gestionnaire résolu: ${g.nom} (ID=${g.id})`, "email-service");
            }

            const newBien = await storage.createBien({
              adresse: adresseEffective,
              codePostal: codePostalEffectif,
              ville: parsed.bien?.ville || "",
              gestionnaireId: resolvedGestionnaireId,
              information: null,
              complementAdresse: null,
            });
            bienId = newBien.id;
            gestionnaireId = resolvedGestionnaireId;
            log(`Nouveau bien créé: ID=${bienId}${resolvedGestionnaireId ? ` avec gestionnaire ID=${resolvedGestionnaireId}` : " sans gestionnaire"}`, "email-service");
          }

          if (!bienId) {
            throw new Error("Impossible de déterminer le bien");
          }

          const contactsText = contacts
            .filter((c) => c.nom || c.telephone)
            .map((c) => [c.nom, c.qualite, c.telephone, c.email].filter(Boolean).join(" | "))
            .join("\n");

          const commentaireParts = [
            `Créé automatiquement depuis email de: ${email.from}`,
            urgence !== "Normal" ? `Urgence: ${urgence}` : null,
            parsed.syndic ? `Syndic: ${parsed.syndic}` : null,
            codesAcces ? `Codes d'accès: ${codesAcces}` : null,
            contactsText ? `Contacts:\n${contactsText}` : null,
          ].filter(Boolean);

          const demande = await storage.createDemande({
            bienId,
            gestionnaireId,
            objet: objetEffectif.slice(0, 200),
            detail: parsed.demande?.detail || email.body.slice(0, 500) || null,
            metier: "Autre",
            etat: "nouvelle",
            dateDemandeClient: email.date,
            refSyndic: parsed.demande?.ref_syndic || null,
            commentaire: commentaireParts.join("\n"),
            travauxEnerpur: false,
            infoManquantes,
            champsManquants: infoManquantes ? champsManquantsList.join(", ") : null,
          });
          demandeId = demande.id;
          log(`Demande créée: ID=${demandeId}`, "email-service");

          const contactsToSave = contacts
            .filter((c) => c.nom || c.telephone || c.email)
            .map((c) => ({
              demandeId: demande.id,
              nom: c.nom || null,
              telephone: c.telephone || null,
              email: c.email || null,
              qualite: CONTACT_QUALITES.includes(c.qualite as typeof CONTACT_QUALITES[number])
                ? c.qualite as string
                : "autre",
            }));
          if (contactsToSave.length > 0) {
            await storage.createContacts(contactsToSave);
            log(`${contactsToSave.length} contact(s) enregistré(s) pour demande ID=${demandeId}`, "email-service");
          }

          await moveEmailToImapFolder(email.uid, IMAP_FOLDER_ARCHIVE);
        } catch (demandeErr) {
          createErreur = String(demandeErr);
          log(`Erreur création demande: ${demandeErr}`, "email-service");
          await moveEmailToImapFolder(email.uid, IMAP_FOLDER_ERRORS);
        }

        await storage.createEmailLog({
          messageId: email.messageId,
          receivedAt: email.date,
          from: email.from,
          subject: email.subject,
          body: email.body || null,
          statut: demandeId !== null ? "traite" : "erreur",
          demandeId,
          erreur: createErreur,
          rawParsed: JSON.stringify(parsed),
        });

        if (demandeId !== null) {
          processed++;
        } else {
          errors++;
        }
      } catch (emailErr) {
        log(`Erreur traitement email "${email.subject}": ${emailErr}`, "email-service");
        try {
          await storage.createEmailLog({
            messageId: email.messageId,
            receivedAt: email.date,
            from: email.from,
            subject: email.subject,
            body: email.body || null,
            statut: "erreur",
            demandeId: null,
            erreur: String(emailErr),
            rawParsed: null,
          });
        } catch (_logErr) {
          log(`Erreur écriture log email: ${_logErr}`, "email-service");
        }
        errors++;
      }
    }
  } catch (err) {
    const msg = String(err);
    log(`Erreur générale du service email: ${msg}`, "email-service");
    emailServiceState.lastError = msg;
    throw err;
  } finally {
    isProcessing = false;
  }

  return { processed, errors, ignored };
}

function scheduleNextPoll() {
  if (pollingTimer) clearTimeout(pollingTimer);

  emailServiceState.nextCheck = new Date(Date.now() + emailServiceState.intervalMs);

  pollingTimer = setTimeout(async () => {
    if (!emailServiceState.enabled) return;
    emailServiceState.lastCheck = new Date();
    emailServiceState.nextCheck = null;
    emailServiceState.lastError = null;

    try {
      await processEmails();
    } catch (err) {
      emailServiceState.lastError = String(err);
    } finally {
      if (emailServiceState.enabled) scheduleNextPoll();
    }
  }, emailServiceState.intervalMs);
}

export function startEmailPolling() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    log("GMAIL_USER ou GMAIL_APP_PASSWORD non configuré — service email désactivé", "email-service");
    return;
  }

  emailServiceState.enabled = true;
  log(`Service email démarré (polling toutes les ${emailServiceState.intervalMs / 1000}s)`, "email-service");
  scheduleNextPoll();
}

export function stopEmailPolling() {
  emailServiceState.enabled = false;
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  log("Service email arrêté", "email-service");
}

export async function triggerManualSync(): Promise<{ processed: number; errors: number; ignored: number }> {
  return processEmails();
}
