# US005 - Envoi des donnees vers CRM-API

## User Story

**En tant que** systeme automatise  
**Je veux** envoyer les donnees extraites vers l'API CRM  
**Afin de** creer les biens et demandes dans le systeme

---

## Criteres d'acceptation

### Scenario 1: Bien nouveau
**Donne** des donnees extraites pour une adresse inconnue  
**Quand** le systeme cherche le bien dans le CRM  
**Alors** un nouveau bien est cree puis la demande est ajoutee

### Scenario 2: Bien existant
**Donne** des donnees pour une adresse deja enregistree  
**Quand** le systeme cherche le bien dans le CRM  
**Alors** le bien existant est utilise et la demande est ajoutee

### Scenario 3: Matching ambigu
**Donne** des donnees pour une adresse similaire mais pas identique  
**Quand** le systeme cherche le bien dans le CRM  
**Alors** les candidats sont proposes pour validation manuelle

### Scenario 4: API indisponible
**Donne** des donnees valides  
**Quand** l'API CRM ne repond pas  
**Alors** les donnees sont mises en queue pour retry

---

## Specifications techniques

### Flux d'envoi

```
1. Rechercher bien existant
   GET /api/biens/search?adresse=...&code_postal=...

2a. Si best_match.score >= 0.9:
    → Utiliser bien_id existant

2b. Si best_match.score < 0.9 ou pas de match:
    → POST /api/biens (creer nouveau bien)

3. Creer la demande
   POST /api/demandes avec bien_id
```

### Mapping donnees parser → API

| Parser | API Bien | API Demande |
|--------|----------|-------------|
| bien.adresse | adresse | - |
| bien.code_postal | code_postal | - |
| bien.ville | ville | - |
| bien.information | information | - |
| demande.objet | - | objet |
| demande.detail | - | detail |
| ref_syndic | - | ref_syndic |
| gestionnaire.id | gestionnaire_id | gestionnaire_id |
| date_email | - | date_demande_client |

### Configuration

```
CRM_API_URL=http://localhost:5000/api
CRM_API_TIMEOUT=30
CRM_API_RETRY_COUNT=3
CRM_API_RETRY_DELAY=5
```

---

## Gestion des erreurs

| Code HTTP | Action |
|-----------|--------|
| 201 | Succes, logger et continuer |
| 400 | Donnees invalides, marquer pour correction |
| 404 | Endpoint manquant, alerter admin |
| 429 | Rate limit, attendre et retry |
| 500 | Erreur serveur, retry avec backoff |
| Timeout | Retry 3x puis mettre en queue |

---

## Definition of Done

- [ ] Client HTTP vers CRM-API
- [ ] Recherche bien existant
- [ ] Creation bien si nouveau
- [ ] Creation demande
- [ ] Gestion retry et backoff
- [ ] Queue pour erreurs temporaires
- [ ] Logging des appels API
- [ ] Tests integration (mock API)
