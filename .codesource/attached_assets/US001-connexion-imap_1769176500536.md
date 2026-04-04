# US001 - Connexion IMAP et lecture des emails

## User Story

**En tant que** systeme automatise  
**Je veux** me connecter a la boite email et lire les nouveaux messages  
**Afin de** recuperer les demandes d'intervention a traiter

---

## Criteres d'acceptation

### Scenario 1: Connexion reussie
**Donne** des credentials IMAP valides  
**Quand** le service demarre  
**Alors** la connexion est etablie et les emails non lus sont listes

### Scenario 2: Connexion echouee
**Donne** des credentials invalides  
**Quand** le service tente de se connecter  
**Alors** une erreur est loggee et une alerte est envoyee

### Scenario 3: Polling periodique
**Donne** une connexion etablie  
**Quand** le timer de 5 minutes expire  
**Alors** les nouveaux emails sont recuperes

---

## Specifications techniques

### Variables d'environnement requises
```
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_USER=email@example.com
IMAP_PASSWORD=secret
IMAP_FOLDER=INBOX
```

### Structure de sortie
```python
{
    "email_id": "unique-id",
    "from": "sender@example.com",
    "to": ["recipient@example.com"],
    "cc": [],
    "subject": "Sujet de l'email",
    "date": "2025-10-14T17:30:00Z",
    "body_text": "Contenu texte",
    "body_html": "<html>...</html>",
    "attachments": [
        {"filename": "doc.pdf", "content_type": "application/pdf", "size": 12345}
    ]
}
```

---

## Definition of Done

- [ ] Connexion IMAP fonctionnelle
- [ ] Lecture des emails non lus
- [ ] Extraction body text et HTML
- [ ] Extraction des pieces jointes (metadata)
- [ ] Gestion des erreurs de connexion
- [ ] Logging detaille
- [ ] Tests unitaires
