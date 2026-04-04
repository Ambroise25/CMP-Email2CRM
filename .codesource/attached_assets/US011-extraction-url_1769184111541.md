# US011 - Extraction de donnees depuis les URLs

## User Story

**En tant que** systeme automatise  
**Je veux** extraire les informations depuis les URLs presentes dans les emails  
**Afin de** recuperer les details complets de la demande hebergee sur un portail ou PDF externe

---

## Criteres d'acceptation

### Scenario 1: URL vers un PDF
**Donne** un email contenant une URL vers un PDF (ordre de service)  
**Quand** le parser detecte l'URL  
**Alors** le PDF est telecharge, son texte est extrait et analyse par le LLM

### Scenario 2: URL vers une page web
**Donne** un email contenant une URL vers un portail syndic  
**Quand** le parser detecte l'URL  
**Alors** la page est telechargee, le contenu HTML est extrait et analyse par le LLM

### Scenario 3: Fusion des donnees
**Donne** des informations dans l'email ET dans l'URL  
**Quand** le parsing est termine  
**Alors** les donnees sont fusionnees (URL complete l'email)

### Scenario 4: URL inaccessible
**Donne** une URL qui retourne une erreur (404, timeout)  
**Quand** le parser tente d'acceder a l'URL  
**Alors** l'erreur est loggee et le parsing continue avec l'email seul

---

## Specifications techniques

### Detection des URLs

```python
import re

URL_PATTERN = r'https?://[^\s<>"\']+[^\s<>"\'.,;:!?\)]'

def extract_urls(text):
    """Extrait toutes les URLs d'un texte"""
    return re.findall(URL_PATTERN, text)
```

### URLs a ignorer

| Pattern | Raison |
|---------|--------|
| `mailto:` | Lien email |
| `unsubscribe` | Lien de desinscription |
| `signature` | Signature email |
| `logo`, `image` | Assets visuels |
| `facebook`, `linkedin`, `twitter` | Reseaux sociaux |

### Types de contenu supportes

| Type | Extension/MIME | Traitement |
|------|----------------|------------|
| PDF | .pdf, application/pdf | Extraction texte avec PyPDF2 ou pdfplumber |
| HTML | text/html | Extraction texte avec BeautifulSoup |

### Extraction PDF

```python
import requests
import pdfplumber
from io import BytesIO

def extract_pdf_text(url):
    response = requests.get(url, timeout=30)
    if response.headers.get('content-type', '').startswith('application/pdf'):
        with pdfplumber.open(BytesIO(response.content)) as pdf:
            text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        return text
    return None
```

### Extraction HTML

```python
import requests
from bs4 import BeautifulSoup

def extract_html_text(url):
    response = requests.get(url, timeout=30)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Supprimer scripts, styles, nav, footer
    for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
        tag.decompose()
    
    return soup.get_text(separator='\n', strip=True)
```

### Prompt LLM pour contenu URL

```
Extrait les informations de demande d'intervention depuis ce contenu 
(provenant d'un document PDF ou d'une page web).

Meme format de sortie que pour les emails:
- adresse, code_postal, ville
- objet, metier, urgence
- ref_syndic, contacts
- codes_acces
```

### Fusion des donnees

```python
def merge_data(email_data, url_data):
    """
    Fusionne les donnees email et URL.
    Les donnees URL completent les champs manquants de l'email.
    L'email a priorite si conflit.
    """
    merged = email_data.copy()
    
    for key, value in url_data.items():
        if key not in merged or merged[key] is None:
            merged[key] = value
        elif isinstance(value, dict):
            merged[key] = {**value, **merged[key]}
    
    return merged
```

### Structure de sortie enrichie

```json
{
  "sources": {
    "email": true,
    "url": "https://portail.syndic.fr/demande/12345",
    "url_type": "html"
  },
  "adresse": "12 rue de la Paix",
  "code_postal": "75002",
  "ville": "Paris",
  "objet": "Infiltration terrasse",
  "metier": "Etancheite",
  "ref_syndic": "OS-2026-12345",
  "confiance_globale": 0.92
}
```

---

## Limites et securite

| Parametre | Valeur |
|-----------|--------|
| Timeout requete | 30 secondes |
| Taille max PDF | 10 MB |
| Taille max HTML | 5 MB |
| Max URLs par email | 5 |
| Retry en cas d'echec | 2 tentatives |

### Domaines de confiance (optionnel)

Pour limiter les risques, on peut maintenir une liste blanche de domaines :
- Portails syndics connus (Foncia, Nexity, etc.)
- Services de partage de documents

---

## Dependencies Python

```
requests>=2.28.0
pdfplumber>=0.7.0
beautifulsoup4>=4.11.0
```

---

## Definition of Done

- [ ] Detection des URLs dans le corps de l'email
- [ ] Filtrage des URLs non pertinentes (reseaux sociaux, logos)
- [ ] Telechargement et extraction de texte depuis PDF
- [ ] Telechargement et extraction de texte depuis HTML
- [ ] Analyse du contenu extrait par le LLM
- [ ] Fusion des donnees email + URL
- [ ] Gestion des erreurs (timeout, 404, etc.)
- [ ] Tests avec emails contenant des URLs de test
