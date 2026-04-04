# API Gestion de Biens Immobiliers

## Overview
API REST pour la gestion de biens immobiliers et demandes d'intervention avec CRUD complet, pagination, filtres avances, et recherche intelligente par adresse avec scoring de similarite.

## Recent Changes
- 2026-04-04: Email parser integrated — Gmail IMAP polling, Mistral AI parsing via OpenRouter (ministral-8b-2512), LLM classification step (OUI/NON), automatic bien/demande creation, IMAP archiving to "Email traite"/"Erreurs" folders, `/emails` UI page
- 2026-03-03: US002 - Added CRUD for demandes (intervention requests) with enums for etats/metiers, filters, and frontend pages
- 2026-02-20: Initial implementation - CRUD API for biens, search with similarity scoring, PostgreSQL database with seed data

## Project Architecture
- **Frontend**: React + Vite + TanStack Query + wouter (routing) + shadcn/ui
- **Backend**: Express.js with REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: `shared/schema.ts` - biens, gestionnaires, and demandes tables with relations

## Key Files
- `shared/schema.ts` - Data models (biens, gestionnaires, demandes) + Zod validation schemas + enums (ETATS, METIERS)
- `server/routes.ts` - API endpoints for biens, gestionnaires, and demandes
- `server/storage.ts` - DatabaseStorage with CRUD operations, address similarity search, and demandes filters
- `server/seed.ts` - Seed data (5 gestionnaires, 8 biens, 7 demandes)
- `server/db.ts` - Drizzle database connection
- `client/src/pages/biens-list.tsx` - Biens list with pagination/search
- `client/src/pages/bien-detail.tsx` - Bien detail view
- `client/src/pages/bien-form.tsx` - Create/edit bien form
- `client/src/pages/bien-search.tsx` - Advanced address search
- `client/src/pages/demandes-list.tsx` - Demandes list with etat/metier filters
- `client/src/pages/demande-detail.tsx` - Demande detail with bien and gestionnaire info
- `client/src/pages/demande-form.tsx` - Create/edit demande form

## API Endpoints
### Biens
- `GET /api/biens?page=1&limit=20&search=...` - List biens with pagination
- `GET /api/biens/:id` - Get single bien with gestionnaire
- `POST /api/biens` - Create bien (validates required fields)
- `PUT /api/biens/:id` - Update bien (partial update)
- `GET /api/biens/search?adresse=...&code_postal=...` - Smart search with similarity scoring

### Demandes
- `GET /api/demandes?page=1&limit=20&bien_id=...&etat=...&metier=...` - List demandes with filters
- `GET /api/demandes/:id` - Get single demande with bien and gestionnaire
- `POST /api/demandes` - Create demande (validates bien_id exists, enum values)
- `PUT /api/demandes/:id` - Update demande (partial update)

### Other
- `GET /api/gestionnaires` - List all gestionnaires

## Enums
- **Etats**: nouvelle, en_cours, rdv_programme, terminee, annulee
- **Metiers**: Etancheite, Plomberie, Electricite, Autre
