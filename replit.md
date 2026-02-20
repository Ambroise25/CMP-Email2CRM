# API Gestion de Biens Immobiliers

## Overview
API REST pour la gestion de biens immobiliers avec CRUD complet, pagination, et recherche intelligente par adresse avec scoring de similarite.

## Recent Changes
- 2026-02-20: Initial implementation - CRUD API for biens, search with similarity scoring, PostgreSQL database with seed data

## Project Architecture
- **Frontend**: React + Vite + TanStack Query + wouter (routing) + shadcn/ui
- **Backend**: Express.js with REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: `shared/schema.ts` - biens and gestionnaires tables with relations

## Key Files
- `shared/schema.ts` - Data models (biens, gestionnaires) + Zod validation schemas
- `server/routes.ts` - API endpoints (GET/POST/PUT /api/biens, GET /api/biens/search, GET /api/gestionnaires)
- `server/storage.ts` - DatabaseStorage with CRUD operations and address similarity search
- `server/seed.ts` - Seed data (5 gestionnaires, 8 biens)
- `server/db.ts` - Drizzle database connection
- `client/src/pages/` - React pages (list, detail, form, search)

## API Endpoints
- `GET /api/biens?page=1&limit=20&search=...` - List biens with pagination
- `GET /api/biens/:id` - Get single bien with gestionnaire
- `POST /api/biens` - Create bien (validates required fields)
- `PUT /api/biens/:id` - Update bien (partial update)
- `GET /api/biens/search?adresse=...&code_postal=...` - Smart search with similarity scoring
- `GET /api/gestionnaires` - List all gestionnaires
