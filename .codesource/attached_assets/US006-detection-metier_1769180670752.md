# US006 - Detection du metier

## User Story

**En tant que** systeme automatise  
**Je veux** identifier le corps de metier concerne par la demande  
**Afin de** router correctement la demande vers l'equipe appropriee

---

## Criteres d'acceptation

### Scenario 1: Demande d'etancheite
**Donne** un email mentionnant "fuite toiture", "infiltration terrasse"  
**Quand** le parser analyse l'email  
**Alors** le metier est identifie comme "Etancheite"

### Scenario 2: Demande de plomberie
**Donne** un email mentionnant "fuite canalisation", "WC bouche"  
**Quand** le parser analyse l'email  
**Alors** le metier est identifie comme "Plomberie"

### Scenario 3: Demande de couverture
**Donne** un email mentionnant "tuiles cassees", "gouttiere"  
**Quand** le parser analyse l'email  
**Alors** le metier est identifie comme "Couverture"

### Scenario 4: Metier incertain
**Donne** un email sans indication claire du metier  
**Quand** le parser analyse l'email  
**Alors** le metier est "Autre" avec une confiance faible

---

## Specifications techniques

### Metiers possibles

| Metier | Mots-cles indicateurs |
|--------|----------------------|
| Etancheite | fuite toiture, infiltration, terrasse, etancheite |
| Plomberie | canalisation, WC, robinet, evacuation, tuyau |
| Couverture | tuile, ardoise, gouttiere, cheminee, zinc |
| Autre | aucun mot-cle identifie |

### Prompt LLM enrichi

```
Identifie le corps de metier concerne par cette demande.
Valeurs possibles: Etancheite, Plomberie, Couverture, Autre

Criteres:
- Etancheite: toiture-terrasse, infiltrations par le toit plat
- Plomberie: fuites interieures, canalisations, sanitaires
- Couverture: toiture traditionnelle, tuiles, ardoises
- Autre: si tu ne peux pas determiner
```

### Structure de sortie

```json
{
  "metier": "Etancheite",
  "metier_confiance": 0.92,
  "indices": ["fuite terrasse", "infiltration"]
}
```

---

## Definition of Done

- [ ] Detection des 4 metiers (Etancheite, Plomberie, Couverture, Autre)
- [ ] Score de confiance sur le metier
- [ ] Extraction des indices ayant mene a la decision
- [ ] Tests avec emails de chaque metier
