# Décisions Techniques

## 2026-01-07 : Choix de la stack

### Contexte
Création de l'application Email Parser pour Email2Extranet.

### Décision
- **Langage Backend** : Python 3.11
- **Framework API** : Flask (léger, simple)
- **Client IMAP** : imaplib (bibliothèque standard Python)
- **Frontend** : React + TypeScript (existant dans le projet)

### Raisons
- Python est bien adapté pour le parsing d'emails et l'intégration LLM
- imaplib est inclus dans la bibliothèque standard Python, pas de dépendance externe
- Flask est minimaliste et suffisant pour une API simple

---

## 2026-01-07 : Approche "Two to Tango"

### Contexte
Définition de la méthodologie de travail.

### Décision
Suivre la méthode "Two to Tango" avec :
1. Baby Steps : Une fonctionnalité à la fois
2. Documentation = Source de Vérité : replit.md comme mémoire
3. Validation Continue : Proposer avant de faire

### Raisons
- Éviter les erreurs coûteuses
- Garder une trace des décisions
- Permettre une collaboration efficace
