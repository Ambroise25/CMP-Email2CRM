# User Stories - Email2Extranet

Ce fichier documente les user stories complétées pour le projet Email Parser.

---

## US001 : Connexion IMAP et lecture des emails

**Date de complétion** : 23 janvier 2026

**Statut** : ✅ Terminée

### Description
Permettre la connexion à un serveur IMAP et la lecture des emails non lus avec extraction complète des métadonnées.

### Fonctionnalités implémentées

1. **Variables d'environnement étendues**
   - `IMAP_PORT` : Port IMAP SSL (défaut: 993)
   - `IMAP_FOLDER` : Dossier à surveiller (défaut: INBOX)

2. **Structure de sortie enrichie**
   - Champ `cc` : liste des destinataires en copie
   - Champ `body_html` : corps HTML de l'email
   - Champ `body_text` : corps texte de l'email
   - Champ `to` : liste des destinataires

3. **Polling automatique**
   - Vérification toutes les 5 minutes en arrière-plan
   - Endpoints API : `/api/polling/start`, `/api/polling/stop`, `/api/polling/status`
   - Interface de contrôle (boutons démarrer/arrêter)

4. **Logging détaillé**
   - Logs de connexion IMAP
   - Logs d'erreurs avec stack traces
   - Logs de récupération des emails

### Fichiers modifiés
- `imap_client.py` : Support IMAP_PORT/IMAP_FOLDER, extraction CC/body_html, logging
- `main.py` : Endpoints polling, worker thread
- `server/routes.ts` : Proxy vers endpoints polling
- `client/src/pages/home.tsx` : Interface contrôle polling

---

## US004 : Parsing LLM (Mistral)

**Date de complétion** : 23 janvier 2026

**Statut** : ✅ Terminée

### Description
Utiliser un LLM (Mistral) pour extraire les données structurées de tous les emails de façon uniforme.

### Fonctionnalités implémentées

1. **Nouvelle structure JSON**
   - `bien` : adresse, code_postal, ville, nom_copropriete
   - `demande` : objet, detail, metier, urgence, ref_syndic
   - `contacts` : liste avec nom, telephone, email, qualite
   - `codes_acces` : informations d'accès (digicode, etc.)
   - `syndic` et `gestionnaire`

2. **Détection automatique**
   - Métier : Etancheite, Plomberie, Couverture, Autre
   - Urgence : Urgent, Normal, Faible (basé sur mots-clés)

3. **Score de confiance**
   - Confiance par section (bien, demande, contacts, syndic, codes_acces)
   - Confiance globale calculée
   - Flag `needs_review` si confiance < 0.5

4. **Gestion d'erreurs robuste**
   - Retry 3x avec délai de 2s
   - Fallback regex si LLM échoue
   - Troncature contenu à 15000 caractères (fix erreur 413)

5. **Logging**
   - Tokens utilisés par requête
   - Erreurs et tentatives

### Fichiers modifiés
- `llm_parser.py` : Refonte complète avec US004
- `main.py` : Passage attachment_text séparé
- `client/src/pages/home.tsx` : Affichage nouvelle structure

---

## US005 : Gestion des emails volumineux

**Date de complétion** : 23 janvier 2026

**Statut** : ✅ Terminée

### Description
Permettre le parsing d'emails volumineux avec beaucoup de texte ou plusieurs pièces jointes.

### Fonctionnalités implémentées

1. **Résumé automatique des contenus longs**
   - PDFs > 5000 caractères : résumés via LLM avant parsing
   - Email body > 10000 caractères : résumé automatique
   - Pièces jointes combinées > 15000 caractères : résumé global

2. **Limites avec budgeting explicite**
   - MAX_CONTENT_CHARS : 25000 (limite finale)
   - MAX_BODY_CHARS : 10000 (corps email)
   - MAX_TOTAL_ATTACHMENTS : 15000 (pièces jointes)
   - Prompt de résumé spécialisé (adresses, contacts, problèmes, codes)

3. **Gestion progressive des erreurs 413**
   - 1ère tentative : troncature à 10000 chars
   - 2ème tentative : troncature à 5000 chars
   - 3ème tentative : email body seul (3000 chars)

4. **Import robuste**
   - Fallback si import summarize_long_content échoue
   - Troncature simple en cas de problème

### Fichiers modifiés
- `llm_parser.py` : summarize_long_content, gestion 413 progressive
- `attachment_processor.py` : résumé PDFs, import robuste

---

## User Stories à venir

*(Les prochaines US seront documentées ici une fois complétées)*
