# CRM API — Gestion de Biens Immobiliers

API REST complète pour la gestion de biens immobiliers et demandes d'intervention, avec parsing automatique d'emails entrants via IA.

## Fonctionnalités

- **Biens** : CRUD complet avec pagination et recherche intelligente par adresse (scoring de similarité)
- **Demandes d'intervention** : CRUD avec filtres par état, métier et bien associé
- **Gestionnaires** : référentiel de gestionnaires liés aux biens
- **Email parser** : polling IMAP Gmail, classification et parsing par LLM (Mistral via OpenRouter), création automatique de biens/demandes

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + Vite + TanStack Query + wouter + shadcn/ui |
| Backend | Express.js (TypeScript) |
| Base de données | PostgreSQL + Drizzle ORM |
| IA | Mistral (ministral-8b-2512) via OpenRouter |

## Prérequis

- Node.js 20+
- PostgreSQL
- Compte Gmail avec mot de passe applicatif (pour le parsing d'emails)
- Clé API OpenRouter

## Installation

```bash
npm install
npm run db:push   # Initialise le schéma de base de données
npm run dev       # Démarre le serveur (port 5000)
```

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `SESSION_SECRET` | Secret pour les sessions |
| `GMAIL_USER` | Adresse Gmail pour le polling IMAP |
| `GMAIL_APP_PASSWORD` | Mot de passe applicatif Gmail |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | Clé API OpenRouter |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | URL de base OpenRouter |

## API Endpoints

### Biens
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/biens?page=1&limit=20&search=...` | Liste avec pagination |
| `GET` | `/api/biens/:id` | Détail d'un bien |
| `POST` | `/api/biens` | Création |
| `PUT` | `/api/biens/:id` | Mise à jour |
| `GET` | `/api/biens/search?adresse=...&code_postal=...` | Recherche par adresse |

### Demandes
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/demandes?page=1&limit=20&bien_id=...&etat=...&metier=...` | Liste avec filtres |
| `GET` | `/api/demandes/:id` | Détail d'une demande |
| `POST` | `/api/demandes` | Création |
| `PUT` | `/api/demandes/:id` | Mise à jour |

### Autres
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/gestionnaires` | Liste des gestionnaires |
| `GET` | `/api/emails/logs` | Logs du parser d'emails |

## Énumérations

- **États** : `nouvelle` · `en_cours` · `rdv_programme` · `terminee` · `annulee`
- **Métiers** : `Etancheite` · `Plomberie` · `Electricite` · `Autre`

## Structure du projet

```
├── client/          # Frontend React
│   └── src/pages/   # Pages (biens, demandes, emails)
├── server/          # Backend Express
│   ├── routes.ts    # Endpoints API
│   ├── storage.ts   # Couche d'accès aux données
│   ├── email-service.ts  # Parser d'emails IMAP + LLM
│   └── seed.ts      # Données de test
└── shared/
    └── schema.ts    # Schéma Drizzle + types Zod
```
