# US007 - Evaluation de l'urgence

## User Story

**En tant que** systeme automatise  
**Je veux** evaluer le niveau d'urgence de chaque demande  
**Afin de** prioriser les interventions selon la gravite

---

## Criteres d'acceptation

### Scenario 1: Urgence elevee
**Donne** un email mentionnant une fuite active avec degats  
**Quand** le parser analyse l'email  
**Alors** l'urgence est "Urgent" et la demande est mise en evidence

### Scenario 2: Urgence normale
**Donne** un email de demande de devis sans fuite active  
**Quand** le parser analyse l'email  
**Alors** l'urgence est "Normal"

### Scenario 3: Urgence faible
**Donne** un email de demande preventive ou de controle  
**Quand** le parser analyse l'email  
**Alors** l'urgence est "Faible"

---

## Specifications techniques

### Niveaux d'urgence

| Niveau | Criteres | Exemples |
|--------|----------|----------|
| Urgent | Fuite active, degats en cours, mots: urgent, immediat | "Eau qui coule dans l'appartement" |
| Normal | Demande de devis, chiffrage, pas de degat | "Devis pour refection etancheite" |
| Faible | Preventif, controle annuel, pas de probleme | "Controle annuel terrasse" |

### Mots-cles d'urgence

```python
URGENCE_HAUTE = [
    "urgent", "urgence", "immediat", "en cours",
    "fuite importante", "degats", "innonde",
    "eau qui coule", "sinistre"
]

URGENCE_FAIBLE = [
    "devis", "chiffrage", "controle", "preventif",
    "annuel", "verification"
]
```

### Prompt LLM enrichi

```
Evalue l'urgence de cette demande d'intervention.
Valeurs possibles: Urgent, Normal, Faible

Criteres:
- Urgent: fuite active, degats en cours, sinistre
- Normal: demande de devis, pas de fuite active
- Faible: preventif, controle, pas de probleme signale
```

### Structure de sortie

```json
{
  "urgence": "Urgent",
  "urgence_confiance": 0.95,
  "raison": "Fuite active mentionnee - eau qui coule"
}
```

---

## Definition of Done

- [ ] Detection des 3 niveaux d'urgence
- [ ] Score de confiance sur l'urgence
- [ ] Raison de l'evaluation stockee
- [ ] Tests avec emails urgents et non-urgents
