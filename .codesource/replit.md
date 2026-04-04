# Email2Extranet - Email Parser

## Description du Projet

Application d'extraction automatique des demandes d'intervention depuis les emails de syndics immobiliers.

**Métier** : Étanchéité (toujours)

**Objectif** : Parser les emails reçus des syndics pour extraire les informations structurées :

**Informations principales :**
- Syndic, Référence, Objet

**Lieu d'intervention :**
- Adresse, Code postal, Ville
- Lieu précis (bâtiment, étage, appartement, emplacement exact)

**Contacts :**
- Gestionnaire (nom, téléphone, email)
- Copropriétaire (nom, téléphone, email)
- Conseil syndical (nom, téléphone)
- Gardien (nom, téléphone)

## Philosophie "Two to Tango"

Ce projet suit la méthode "Two to Tango" avec 3 principes fondamentaux :

### 1. Baby Steps
- On avance par petites étapes. Une fonctionnalité à la fois.
- On livre petit, on teste, on valide, puis on continue.
- Pas de perfection, juste de la valeur incrémentale.

### 2. Documentation = Source de Vérité
- Si ce n'est pas écrit, ça n'existe pas.
- Avant de coder, on documente ce qu'on va faire.
- Ce fichier `replit.md` sert de mémoire du projet.

### 3. Validation Continue
- Demander permission avant toute action externe (push GitHub, API calls, etc.)
- Proposer ce qu'on va faire AVANT de le faire.
- On teste chaque étape avant de passer à la suivante.

## Structure du Projet

```
email-parser/
├── replit.md               # Mémoire du projet (ce fichier)
├── docs/
│   └── decisions.md        # Décisions techniques actées
├── main.py                 # Point d'entrée API Flask (port 5001)
├── imap_client.py          # Connexion IMAP + extraction pièces jointes
├── llm_parser.py           # Parser LLM avec Mistral via OpenRouter
├── attachment_processor.py # Traitement PDF (pdfplumber) et images (vision LLM)
├── url_extractor.py        # Extraction contenu depuis URLs (PDF/HTML)
└── crm_client.py           # Client HTTP pour l'API CRM avec retry/backoff
```

## Variables d'Environnement

| Variable | Description | Exemple | Défaut |
|----------|-------------|---------|--------|
| `IMAP_HOST` | Serveur IMAP | imap.gmail.com, ssl0.ovh.net | (requis) |
| `IMAP_PORT` | Port IMAP SSL | 993 | 993 |
| `IMAP_USER` | Adresse email | contact@example.com | (requis) |
| `IMAP_PASSWORD` | Mot de passe ou App Password | *** | (requis) |
| `IMAP_FOLDER` | Dossier à surveiller | INBOX | INBOX |
| `IMAP_FOLDER_ARCHIVE` | Dossier d'archivage | Email traite | Email traite |
| `IMAP_FOLDER_ERRORS` | Dossier d'erreurs | Erreurs | Erreurs |
| `CRM_API_URL` | URL de base de l'API Extranet | https://...replit.dev/api | https://f72ecdeb-...picard.replit.dev/api |
| `CRM_API_TIMEOUT` | Timeout des requêtes CRM (secondes) | 30 | 30 |
| `CRM_API_RETRY_COUNT` | Nombre de tentatives en cas d'erreur | 3 | 3 |
| `CRM_API_RETRY_DELAY` | Délai entre les tentatives (secondes) | 5 | 5 |

## État Actuel

### Étape 1 : Connexion IMAP (TERMINÉE)
- [x] Créer replit.md
- [x] Configurer les secrets IMAP (IMAP_HOST, IMAP_USER, IMAP_PASSWORD)
- [x] Créer imap_client.py (connexion + lecture 1 email)
- [x] Créer main.py (API Flask sur port 5001)
- [x] Interface minimale React pour tester

### Étape 2 : Parser LLM (TERMINÉE)
- [x] Intégration OpenRouter (via Replit AI Integrations)
- [x] Parser Mistral (mistralai/ministral-8b-2512)
- [x] Extraction données structurées en JSON
- [x] Interface affichage données extraites

### Étape 3 : Traitement pièces jointes (TERMINÉE)
- [x] Extraction des pièces jointes (PDF, images) depuis IMAP
- [x] Extraction de texte depuis PDF (pdfplumber)
- [x] Analyse d'images avec LLM vision (Gemini 2.0 Flash)
- [x] Intégration du contenu des PJ dans le parsing
- [x] Affichage des PJ dans l'interface

### US001 : Connexion IMAP et lecture des emails (TERMINÉE)
- [x] Variables d'environnement IMAP_PORT et IMAP_FOLDER
- [x] Extraction des champs CC et body_html
- [x] Polling automatique toutes les 5 minutes
- [x] Logging détaillé (connexion, erreurs, récupération)
- [x] Interface de contrôle du polling (start/stop)

### US005 : Envoi des données vers Extranet (TERMINÉE)
- [x] Client HTTP vers API Extranet avec retry/backoff exponentiel
- [x] Flux: Gestionnaire (recherche/création) → Bien (recherche/création) → Demande (création)
- [x] Recherche gestionnaire par email, nom ou syndic
- [x] Recherche bien par adresse + code postal (comparaison côté client)
- [x] Création bien si nouveau (avec gestionnaireId, codes_acces en information)
- [x] Création demande (titre, description, numeroOs, adresse, client, bienId)
- [x] Gestion des erreurs (400, 404, 429, 500, timeout)
- [x] Queue locale pour erreurs temporaires
- [x] Bouton "Envoyer au CRM" dans l'interface
- [x] Affichage du résultat détaillé (succès, erreur, IDs créés)

**API Extranet** : `https://f72ecdeb-c4e8-439a-87c3-8b8a95f00ad5-00-3bk76cl6rjsm5.picard.replit.dev/api`
- GET/POST `/api/gestionnaires` (id, nom, prenom, email, telephone, syndic)
- GET/POST `/api/biens` (id, adresse, complementAdresse, codePostal, ville, gestionnaireId, information, travauxEnerpur)
- GET/POST `/api/demandes` (id, numeroOs, titre, description, adresse, client, statut, dateDemande, bienId)

**Mapping données parsées → Extranet** :
- syndic → gestionnaires.syndic
- gestionnaire.nom → gestionnaires.nom + prenom
- bien.adresse → biens.adresse, bien.code_postal → biens.codePostal
- bien.lieu_precis → biens.complementAdresse
- codes_acces → biens.information
- demande.objet → demandes.titre
- demande.detail → demandes.description
- demande.ref_syndic → demandes.numeroOs
- copropriétaire/syndic → demandes.client

### US006 : Détection du métier (TERMINÉE)
- [x] Détection des 4 métiers (Étanchéité, Plomberie, Couverture, Autre)
- [x] Prompt LLM enrichi avec les critères
- [x] Fonction de fallback detect_metier() avec mots-clés
- [x] Affichage dans l'interface avec badge

### US007 : Évaluation de l'urgence (TERMINÉE)
- [x] Détection des 3 niveaux (Urgent, Normal, Faible)
- [x] Mots-clés étendus (devis, préventif, contrôle, sinistre, etc.)
- [x] Fonction detect_urgence() avec fallback
- [x] Badge coloré selon urgence (rouge/gris/outline)

### US008 : Gestion des pièces jointes (TERMINÉE)
- [x] Validation des pièces jointes (taille max 10MB, 20 fichiers max)
- [x] Stockage temporaire sur disque (/tmp/email-parser/attachments/)
- [x] Métadonnées extraites (nom, type, taille, chemin)
- [x] Upload vers API CRM (POST /api/fichiers) avec retry
- [x] Nettoyage automatique après upload
- [x] Affichage des PJ dans l'interface avec statut

### US009 : Archivage des emails traités (TERMINÉE)
- [x] Création du dossier "Email traite" si inexistant
- [x] Déplacement des emails traités avec succès
- [x] Les emails en erreur restent dans INBOX
- [x] Logging de chaque déplacement
- [x] Affichage du statut d'archivage dans l'interface

### US010 : Extraction des codes d'accès et contacts (TERMINÉE)
- [x] Extraction des codes d'accès (digicode, interphone, badge, clé)
- [x] Extraction des contacts avec qualité (gardien, propriétaire, locataire, gestionnaire)
- [x] Parsing des numéros de téléphone (format français)
- [x] Affichage dans l'interface avec section dédiée

### Améliorations Parser (23/01/2026)
- [x] Classification métier : "pissette" = évacuation eau pluviale = Étanchéité
- [x] Mots-clés étanchéité enrichis : balcon, trop-plein, acrotère, EP, descente EP
- [x] Urgence : "demande de devis" → Faible (priorité aux mots-clés faible urgence)
- [x] Prompt LLM enrichi avec classification métier explicite
- [x] Extraction contacts PDF améliorée (conservation impérative)
- [x] Déduplication des contacts : fusion si même téléphone ou noms similaires (ex: "CHARLINE ET JULIE" + "PALENA JULIE" → fusionnés)
- [x] Détection emails transférés (FWD) : extraction du contenu original après les marqueurs de transfert

### US011 : Extraction des URLs (TERMINÉE)
- [x] Détection des URLs dans le corps de l'email et HTML
- [x] Filtrage des URLs non pertinentes (réseaux sociaux, logos, images)
- [x] Téléchargement et extraction de texte depuis PDF (pdfplumber)
- [x] Téléchargement et extraction de texte depuis HTML (BeautifulSoup)
- [x] Extraction des PDFs liés depuis les pages HTML (2 niveaux)
- [x] Fusion des données email + URL + pièces jointes
- [x] Gestion des erreurs (timeout 30s, retry 2x, limites taille)
- [x] Affichage des sources URL dans l'interface

### US012 : Filtrage intelligent des emails (TERMINÉE)
- [x] Classification LLM (OUI/NON) avant parsing complet
- [x] Fallback mots-clés intervention/non-intervention
- [x] Emails non pertinents (factures, newsletters, recrutement) ignorés silencieusement
- [x] Emails non pertinents restent dans la boîte de réception
- [x] Seules les demandes d'intervention sont parsées

### US013 : Archivage automatique post-parsing (TERMINÉE)
- [x] Archivage immédiat dans "Email traite" après parsing réussi
- [x] Archivage retiré du flux CRM (plus de double archivage)
- [x] Badge d'archivage dans le tableau (icône Archive)
- [x] Statut archivé/non archivé dans les détails de la demande
- [x] Bouton "Désarchiver" pour remettre un email dans INBOX
- [x] Endpoint POST /api/emails/:email_id/unarchive
- [x] Fonction unarchive_email() dans imap_client.py

### US014 : Détection des doublons et relances (TERMINÉE)
- [x] Détection par numéro d'OS (ref_syndic) — comparaison insensible à la casse
- [x] Classification : "doublon" (même urgence ou inférieure) vs "relance" (urgence supérieure)
- [x] Champs `duplicate_type` et `duplicate_of` ajoutés aux demandes
- [x] Badge "Doublon" (orange) dans le tableau et les détails
- [x] Badge "Relance" (rouge) dans le tableau et les détails
- [x] Première occurrence conservée sans badge, seules les suivantes sont marquées

### Fix doublons IMAP (TERMINÉE)
- [x] Emails marqués comme lus (\Seen) immédiatement après fetch IMAP
- [x] Cache persistant des message_id traités sur disque (/tmp/email-parser/parsed_message_ids.json)
- [x] Chargement du cache au démarrage Flask (survit aux redémarrages)
- [x] Limite à 1000 entrées (ring buffer) pour éviter croissance infinie
- [x] Emails skippés (non-intervention) aussi persistés dans le cache

### Fix race condition + archivage Gmail (TERMINÉE)
- [x] threading.Lock (parsing_lock) empêche l'exécution concurrente de auto_parse_emails()
- [x] Le polling worker et le bouton "Traitement" ne peuvent plus tourner simultanément
- [x] Endpoint fetch-and-parse retourne 409 si un traitement est déjà en cours
- [x] Fonction quote_folder() dans imap_client.py pour les dossiers avec espaces
- [x] ensure_folder_exists() et move_email_to_folder() utilisent quote_folder()
- [x] Archivage vers "Email traite" fonctionne sur Gmail (plus d'erreur BAD)

### Étape 4 : Améliorations futures (À VENIR)
- [ ] Historique des parsings

## Technologies

- **Backend** : Python 3.11 + Flask
- **IMAP** : imaplib (bibliothèque standard Python)
- **PDF** : pdfplumber (extraction texte)
- **Vision** : Gemini 2.0 Flash (analyse images)
- **Frontend** : React + TypeScript (existant)
- **LLM** : Mistral (ministral-8b-2512) via OpenRouter

## Décisions Techniques

Voir `docs/decisions.md` pour l'historique des décisions.
