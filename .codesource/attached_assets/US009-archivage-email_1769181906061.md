# US009 - Archivage des emails traites

## User Story

**En tant que** systeme automatise  
**Je veux** deplacer les emails traites vers un dossier d'archivage  
**Afin de** ne pas les retraiter et garder une trace

---

## Criteres d'acceptation

### Scenario 1: Email traite avec succes
**Donne** un email traite et envoye au CRM avec succes  
**Quand** le traitement est termine  
**Alors** l'email est deplace vers le dossier "Email traite"

### Scenario 2: Dossier inexistant
**Donne** le dossier "Email traite" n'existe pas  
**Quand** le premier email est traite  
**Alors** le dossier est cree automatiquement

### Scenario 3: Echec de traitement
**Donne** un email dont le traitement a echoue  
**Quand** le traitement echoue  
**Alors** l'email reste dans INBOX (ou va dans "Erreurs")

---

## Specifications techniques

### Dossiers IMAP

| Dossier | Usage |
|---------|-------|
| INBOX | Emails a traiter |
| Email traite | Emails traites avec succes |
| Erreurs | Emails en echec (optionnel) |

### Operations IMAP

```python
# Deplacer un email vers le dossier archive
imap.copy(email_id, "Email traite")
imap.store(email_id, '+FLAGS', '\\Deleted')
imap.expunge()
```

### Configuration

```
IMAP_FOLDER_INBOX=INBOX
IMAP_FOLDER_ARCHIVE=Email traite
IMAP_FOLDER_ERRORS=Erreurs
```

---

## Definition of Done

- [ ] Creation du dossier "Email traite" si inexistant
- [ ] Deplacement des emails traites avec succes
- [ ] Les emails en erreur restent dans INBOX
- [ ] Logging de chaque deplacement
- [ ] Test de non-retraitement des emails archives
