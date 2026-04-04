# US004 - Parsing LLM (Mistral) - Parser principal

## User Story

**En tant que** systeme automatise  
**Je veux** utiliser un LLM pour extraire les donnees de TOUS les emails  
**Afin de** traiter uniformement les demandes de tous les syndics

---

## Principe

**Tous les emails sont parses via LLM** - pas de templates par syndic.
Cette approche est plus flexible car les formats d'email varient meme au sein d'un meme syndic.

---

## Criteres d'acceptation

### Scenario 1: Email standard
**Donne** un email de demande d'intervention  
**Quand** le parser LLM traite l'email  
**Alors** les donnees sont extraites avec un score de confiance

### Scenario 2: Email avec peu d'informations
**Donne** un email avec certains champs manquants  
**Quand** le parser LLM traite l'email  
**Alors** les champs trouves sont extraits, les autres sont null

### Scenario 3: Email ininterpretable
**Donne** un email sans information exploitable  
**Quand** le parser LLM traite l'email  
**Alors** l'email est marque pour revue manuelle avec confiance 0

---

## Specifications techniques

### Provider LLM
- **Modele**: Mistral (via OpenRouter / Replit AI Integrations)
- **Temperature**: 0.1 (reponses deterministes)
- **Max tokens**: 2000

### Prompt systeme

```
Tu es un assistant specialise dans l'extraction de donnees depuis des emails de demande d'intervention pour des travaux du batiment.

Extrait les informations suivantes au format JSON:

## Bien
- adresse: numero et rue
- code_postal: code postal (5 chiffres)
- ville: nom de la ville
- nom_copropriete: nom de la copropriete si present

## Demande
- objet: objet de la demande (description courte)
- detail: description detaillee du probleme
- metier: un parmi [Etancheite, Plomberie, Couverture, Autre]
- urgence: un parmi [Urgent, Normal, Faible]
- ref_syndic: reference ou numero de dossier si present

## Contacts
- contacts: liste des contacts sur place
  - nom: nom complet
  - telephone: numero de telephone
  - email: email si present
  - qualite: role (gardien, proprietaire, locataire, gestionnaire)

## Acces
- codes_acces: informations d'acces (digicode, interphone, cle, etc.)

## Syndic
- syndic: nom du syndic detecte
- gestionnaire: nom du gestionnaire si present

Si une information n'est pas trouvee, utilise null.
Ajoute un champ "confiance" entre 0 et 1 pour chaque section.

Reponds UNIQUEMENT avec le JSON, sans explication.
```

### Exemple de reponse attendue

```json
{
  "bien": {
    "adresse": "29 RUE DES ECONDEAUX",
    "code_postal": "93800",
    "ville": "EPINAY SUR SEINE",
    "nom_copropriete": "Residence Les Lilas"
  },
  "demande": {
    "objet": "Infiltration terrasse",
    "detail": "Fuite d'eau provenant de la terrasse, traces d'humidite au plafond de l'appartement du 4eme",
    "metier": "Etancheite",
    "urgence": "Urgent",
    "ref_syndic": "OS-2026-12345"
  },
  "contacts": [
    {
      "nom": "Mme PALENA",
      "telephone": "0698765432",
      "email": null,
      "qualite": "proprietaire"
    },
    {
      "nom": "M. MARTIN",
      "telephone": "0612345678",
      "email": null,
      "qualite": "gardien"
    }
  ],
  "codes_acces": "Digicode 1234, Interphone MARTIN",
  "syndic": "Foncia",
  "gestionnaire": "Marie Dupont",
  "confiance": {
    "bien": 0.95,
    "demande": 0.90,
    "contacts": 0.85,
    "codes_acces": 0.80,
    "syndic": 0.95,
    "global": 0.89
  }
}
```

---

## Detection du metier

| Metier | Mots-cles indicateurs |
|--------|----------------------|
| Etancheite | toiture-terrasse, infiltration toit, membrane, bitume |
| Plomberie | canalisation, WC, robinet, evacuation, tuyau, fuite interieure |
| Couverture | tuile, ardoise, gouttiere, cheminee, zinc, toiture pente |
| Autre | si aucun indicateur clair |

---

## Evaluation de l'urgence

| Niveau | Criteres |
|--------|----------|
| Urgent | fuite active, degats en cours, sinistre, eau qui coule |
| Normal | demande de devis, pas de fuite active |
| Faible | preventif, controle annuel, pas de probleme signale |

---

## Gestion des erreurs

| Erreur | Action |
|--------|--------|
| Timeout LLM | Retry 3x puis marquer echec |
| Reponse non-JSON | Tenter extraction regex basique |
| Confiance < 0.5 | Marquer pour revue manuelle |
| Quota depasse | Alerter admin, mettre en queue |

---

## Definition of Done

- [ ] Integration OpenRouter/Mistral via Replit
- [ ] Prompt optimise pour extraction complete
- [ ] Detection du metier (Etancheite, Plomberie, Couverture, Autre)
- [ ] Evaluation de l'urgence (Urgent, Normal, Faible)
- [ ] Extraction des codes d'acces
- [ ] Extraction des contacts avec qualite
- [ ] Parsing de la reponse JSON
- [ ] Calcul confiance globale
- [ ] Fallback si LLM echoue
- [ ] Logging des tokens utilises
- [ ] Tests avec emails varies
