# US008 - Gestion des pieces jointes

## User Story

**En tant que** systeme automatise  
**Je veux** extraire et conserver les pieces jointes des emails  
**Afin de** les rendre consultables dans le CRM

---

## Criteres d'acceptation

### Scenario 1: Email avec images
**Donne** un email contenant des photos (JPG, PNG)  
**Quand** le parser traite l'email  
**Alors** les images sont extraites et stockees

### Scenario 2: Email avec PDF
**Donne** un email contenant un ordre de service PDF  
**Quand** le parser traite l'email  
**Alors** le PDF est extrait et stocke

### Scenario 3: Email sans piece jointe
**Donne** un email sans piece jointe  
**Quand** le parser traite l'email  
**Alors** le champ pieces_jointes est vide

### Scenario 4: Upload vers API
**Donne** des pieces jointes extraites  
**Quand** la demande est creee dans le CRM  
**Alors** les fichiers sont uploades via POST /api/fichiers

---

## Specifications techniques

### Types de fichiers acceptes

| Type | Extensions | MIME Types |
|------|------------|------------|
| Images | jpg, jpeg, png, gif | image/* |
| Documents | pdf | application/pdf |
| Autres | doc, docx, xls, xlsx | application/* |

### Stockage temporaire

Les fichiers sont stockes temporairement avant upload :
```
/tmp/email-parser/attachments/{email_id}/
├── photo1.jpg
├── photo2.png
└── ordre_service.pdf
```

### Structure de sortie

```json
{
  "pieces_jointes": [
    {
      "nom": "photo_fuite.jpg",
      "type": "image/jpeg",
      "taille": 245000,
      "chemin_local": "/tmp/email-parser/attachments/msg-123/photo_fuite.jpg"
    }
  ]
}
```

### Limites

| Parametre | Valeur |
|-----------|--------|
| Taille max par fichier | 10 MB |
| Nombre max de fichiers | 20 |
| Types autorises | image/*, application/pdf |

---

## Definition of Done

- [ ] Extraction des pieces jointes depuis l'email
- [ ] Stockage temporaire des fichiers
- [ ] Metadata extraites (nom, type, taille)
- [ ] Upload vers API Extranet
- [ ] Nettoyage des fichiers temporaires apres upload
- [ ] Gestion des erreurs (fichier trop gros, type non autorise)
