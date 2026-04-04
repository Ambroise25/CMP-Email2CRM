# US010 - Extraction des codes d'acces et contacts

## User Story

**En tant que** systeme automatise  
**Je veux** extraire les codes d'acces et informations de contact  
**Afin de** faciliter l'intervention sur site

---

## Criteres d'acceptation

### Scenario 1: Digicode present
**Donne** un email mentionnant "Digicode 1234A"  
**Quand** le parser analyse l'email  
**Alors** le code d'acces est extrait

### Scenario 2: Contact sur place
**Donne** un email avec nom et telephone d'un gardien  
**Quand** le parser analyse l'email  
**Alors** le contact est extrait avec ses coordonnees

### Scenario 3: Plusieurs contacts
**Donne** un email avec plusieurs personnes a contacter  
**Quand** le parser analyse l'email  
**Alors** tous les contacts sont extraits

---

## Specifications techniques

### Types de codes d'acces

| Type | Exemples |
|------|----------|
| Digicode | 1234, A1234, 1234A |
| Interphone | Nom MARTIN, Appt 12 |
| Badge | Demander au gardien |
| Cle | Chez gardien, boite a cle |

### Types de contacts

| Qualite | Description |
|---------|-------------|
| Gardien | Gardien de l'immeuble |
| Proprietaire | Proprietaire de l'appartement |
| Locataire | Occupant |
| Gestionnaire | Contact au syndic |
| Conseil syndical | Membre du CS |

### Prompt LLM enrichi

```
Extrait les codes d'acces et contacts presents dans cet email.

Codes d'acces: digicode, interphone, badge, cle
Contacts: nom, telephone, email, qualite (gardien, proprietaire, locataire, gestionnaire)
```

### Structure de sortie

```json
{
  "codes_acces": "Digicode 1234, Interphone Martin",
  "contacts": [
    {
      "nom": "M. MARTIN",
      "telephone": "0612345678",
      "email": null,
      "qualite": "gardien"
    },
    {
      "nom": "Mme DUPONT",
      "telephone": "0698765432",
      "email": "dupont@email.com",
      "qualite": "proprietaire"
    }
  ]
}
```

---

## Definition of Done

- [ ] Extraction des codes d'acces (digicode, interphone, etc.)
- [ ] Extraction des contacts avec qualite
- [ ] Parsing des numeros de telephone (format francais)
- [ ] Tests avec emails contenant differents types d'acces
