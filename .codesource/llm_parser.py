"""
LLM Parser pour Email2Extranet - US004
Extraction de données structurées avec Mistral via OpenRouter
"""

import os
import json
import re
import time
import logging
import requests
from typing import Dict, Any, Optional, List

logger = logging.getLogger('llm-parser')

# Patterns de détection des emails transférés
FORWARD_PATTERNS = [
    # Patterns anglais
    r'[-]{3,}\s*Forwarded\s+message\s*[-]{3,}',
    r'[-]{3,}\s*Original\s+Message\s*[-]{3,}',
    r'Begin\s+forwarded\s+message:',
    # Patterns français
    r'[-]{3,}\s*Message\s+transf[eé]r[eé]\s*[-]{3,}',
    r'[-]{3,}\s*Message\s+original\s*[-]{3,}',
    r'D[ée]but\s+du\s+message\s+transf[eé]r[eé]',
    # Patterns génériques avec De:/From:
    r'_{5,}',  # Gmail style underscores
    r'\*{5,}',  # Asterisk separators
]

# Patterns d'en-tête de message transféré
FORWARD_HEADER_PATTERNS = [
    r'^(?:De|From)\s*:\s*.+',
    r'^(?:À|To)\s*:\s*.+',
    r'^(?:Date)\s*:\s*.+',
    r'^(?:Objet|Subject)\s*:\s*.+',
    r'^(?:Envoy[eé]\s*le|Sent)\s*:\s*.+',
]


def extract_forwarded_content(email_body: str) -> Dict[str, Any]:
    """
    Détecte et extrait le contenu pertinent d'un email transféré.
    Extrait aussi les métadonnées de l'expéditeur original.
    
    Returns:
        Dict avec:
        - 'is_forwarded': bool - si l'email contient un transfert
        - 'original_content': str - le contenu original (après le marqueur)
        - 'forward_intro': str - l'introduction avant le transfert
        - 'full_content': str - tout le contenu (si pas de transfert détecté)
        - 'original_from': str - expéditeur original (email/nom)
        - 'original_subject': str - sujet original
        - 'original_domain': str - domaine de l'expéditeur original
    """
    result = {
        'is_forwarded': False,
        'original_content': email_body,
        'forward_intro': '',
        'full_content': email_body,
        'original_from': None,
        'original_subject': None,
        'original_domain': None
    }
    
    if not email_body:
        return result
    
    # Chercher les patterns de transfert
    best_match = None
    best_position = len(email_body)
    
    for pattern in FORWARD_PATTERNS:
        match = re.search(pattern, email_body, re.IGNORECASE | re.MULTILINE)
        if match and match.start() < best_position:
            best_match = match
            best_position = match.start()
    
    if best_match:
        result['is_forwarded'] = True
        result['forward_intro'] = email_body[:best_match.start()].strip()
        
        # Extraire le contenu après le marqueur
        after_marker = email_body[best_match.end():].strip()
        
        # Chercher les en-têtes (De:, À:, Date:, Objet:) et extraire les infos
        lines = after_marker.split('\n')
        content_start = 0
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Extraire l'expéditeur original (De: ou From:)
            from_match = re.match(r'^(?:De|From)\s*:\s*(.+)', line_stripped, re.IGNORECASE)
            if from_match:
                result['original_from'] = from_match.group(1).strip()
                # Extraire le domaine de l'email
                email_match = re.search(r'[\w.+-]+@([\w.-]+\.\w+)', result['original_from'])
                if email_match:
                    result['original_domain'] = email_match.group(1).lower()
                content_start = i + 1
                continue
            
            # Extraire le sujet original
            subject_match = re.match(r'^(?:Objet|Subject)\s*:\s*(.+)', line_stripped, re.IGNORECASE)
            if subject_match:
                result['original_subject'] = subject_match.group(1).strip()
                content_start = i + 1
                continue
            
            # Vérifier si c'est une autre ligne d'en-tête
            is_header = False
            for header_pattern in FORWARD_HEADER_PATTERNS:
                if re.match(header_pattern, line_stripped, re.IGNORECASE):
                    is_header = True
                    break
            
            if is_header:
                content_start = i + 1
            else:
                # Première ligne non-en-tête, le contenu commence ici
                break
        
        # Reconstituer le contenu original
        result['original_content'] = '\n'.join(lines[content_start:]).strip()
        
        logger.info(f"Email transféré détecté. From: {result['original_domain']}, Contenu: {len(result['original_content'])} chars")
    
    return result


# Mapping des domaines email vers les noms de syndics
SYNDIC_DOMAIN_MAP = {
    'vertfoncie.com': 'Vert Foncier',
    'vertfoncier.com': 'Vert Foncier',
    'foncia.com': 'Foncia',
    'foncia.fr': 'Foncia',
    'nexity.fr': 'Nexity',
    'nexity.com': 'Nexity',
    'citya.com': 'Citya Immobilier',
    'immo-de-france.com': 'Immo de France',
    'sergic.com': 'Sergic',
    'loiselet-daigremont.com': 'Loiselet & Daigremont',
    'oralia.fr': 'Oralia',
    'cabinet-billon.com': 'Cabinet Billon',
    'ics.fr': 'ICS',
    'collab.ics.fr': 'ICS',
}

# Liste des prestataires/contractors à exclure de la détection syndic
# Ces entreprises sont des fournisseurs de services, pas des syndics
CONTRACTORS_BLACKLIST = [
    'enerpur', 'enerpur etancheite', 'enerpur étanchéité',
    'etancheite', 'étanchéité',
    'plomberie', 'couverture', 'chauffage',
    'electricite', 'électricité',
    'ravalement', 'peinture',
    'menuiserie', 'serrurerie',
    'ascenseur', 'nettoyage',
]


def is_contractor(name: str) -> bool:
    """Vérifie si un nom correspond à un prestataire/contractor (pas un syndic)."""
    if not name:
        return False
    name_lower = name.lower().strip()
    for contractor in CONTRACTORS_BLACKLIST:
        if contractor in name_lower:
            return True
    return False


def detect_syndic_from_domain(domain: str) -> Optional[str]:
    """Détecte le nom du syndic à partir du domaine email."""
    if not domain:
        return None
    
    domain = domain.lower()
    
    # Chercher dans le mapping connu
    if domain in SYNDIC_DOMAIN_MAP:
        return SYNDIC_DOMAIN_MAP[domain]
    
    # Essayer d'extraire un nom du domaine (ex: vertfoncie.com -> Vertfoncie)
    # Nettoyer le domaine
    name_part = domain.split('.')[0]
    if name_part and len(name_part) > 3:
        # Vérifier que ce n'est pas un prestataire
        if is_contractor(name_part):
            return None
        # Capitaliser proprement
        return name_part.capitalize()
    
    return None


def extract_syndic_from_content(text: str) -> Optional[str]:
    """
    Extrait le nom du syndic depuis le contenu de la page/email.
    Cherche les patterns typiques des syndics dans le texte.
    """
    if not text:
        return None
    
    # Patterns pour détecter le syndic dans le contenu
    # Format typique: "VertFoncié" en haut de page, ou "Syndic: XXX"
    syndic_patterns = [
        # Pattern direct avec label
        r'(?:syndic|cabinet|gestionnaire)\s*[:=]\s*([A-ZÀ-Ü][a-zà-ü]*(?:\s+[A-ZÀ-Ü][a-zà-ü]*)*)',
        # Noms de syndics connus au début du texte (souvent en-tête)
        r'^(?:.*?)(VertFonci[eé]|Foncia|Nexity|Citya|Sergic|Oralia)',
    ]
    
    # Chercher les syndics connus dans le texte
    known_syndics = [
        ('VertFoncié', ['vertfoncie', 'vertfoncié', 'vert foncier', 'vertfoncier']),
        ('Foncia', ['foncia']),
        ('Nexity', ['nexity']),
        ('Citya Immobilier', ['citya']),
        ('Sergic', ['sergic']),
        ('Oralia', ['oralia']),
        ('Loiselet & Daigremont', ['loiselet', 'daigremont']),
        ('Cabinet Billon', ['billon']),
        ('Immo de France', ['immo de france']),
        ('ICS', ['collab.ics.fr']),
    ]
    
    text_lower = text.lower()
    
    for syndic_name, patterns in known_syndics:
        for pattern in patterns:
            if pattern in text_lower:
                # Vérifier que ce n'est pas dans un contexte de prestataire
                return syndic_name
    
    return None


MAX_CONTENT_CHARS = 25000
MAX_BODY_CHARS = 10000
MAX_ATTACHMENT_CHARS = 5000
MAX_TOTAL_ATTACHMENTS = 15000
MAX_RETRIES = 3
RETRY_DELAY = 2

SYSTEM_PROMPT = """Tu es un assistant qui extrait des donnees structurees depuis des emails de demande d'intervention batiment.

REGLES METIER:
- pissette, balcon, terrasse, eau pluviale, EP = Etancheite (PAS plomberie)
- WC, robinet, sanitaire, eau chaude = Plomberie
- tuile, ardoise, gouttiere = Couverture

REGLES URGENCE:
- "demande de devis" ou "devis" = Faible
- "fuite active", "sinistre", "urgent" = Urgent
- autres cas = Normal

DISTINCTION SYNDIC vs PRESTATAIRE:
- Le SYNDIC est le gestionnaire immobilier qui ENVOIE la demande (Foncia, Nexity, VertFoncié, Citya, Sergic, Oralia, ICS, etc.)
- Le PRESTATAIRE est l'entreprise qui RECOIT la demande pour faire les travaux (ENERPUR, entreprises d'étanchéité/plomberie/couverture)
- NE JAMAIS mettre le prestataire comme syndic!
- Si l'email vient de collab.ics.fr ou similaire, le syndic est souvent visible en haut de page (ex: "VertFoncié")
- Indices syndic: adresse du syndic, nom du gestionnaire, logo en haut de page

Extrait TOUTES les infos du corps de l'email ET des pieces jointes. Reponds avec ce JSON:

{
  "bien": {"adresse": "...", "code_postal": "...", "ville": "...", "nom_copropriete": "..."},
  "demande": {"objet": "...", "detail": "...", "metier": "Etancheite|Plomberie|Couverture|Autre", "urgence": "Urgent|Normal|Faible", "ref_syndic": "..."},
  "contacts": [{"nom": "...", "telephone": "...", "email": "...", "qualite": "gardien|proprietaire|locataire|gestionnaire|occupant"}],
  "codes_acces": "Digicode: ..., Interphone: ...",
  "syndic": "...",
  "gestionnaire": "...",
  "confiance": {"bien": 0.9, "demande": 0.9, "contacts": 0.9, "codes_acces": 0.9, "syndic": 0.9, "global": 0.9}
}

IMPORTANT: 
- Cherche les contacts dans les PIECES JOINTES (noms, telephones). 
- Le syndic n'est JAMAIS une entreprise de travaux (etancheite, plomberie, etc.)
- Utilise null si absent."""


SUMMARY_PROMPT = """Tu es un assistant spécialisé dans le résumé de documents techniques pour des demandes d'intervention bâtiment.

CONSERVE IMPÉRATIVEMENT toutes les informations suivantes:
- TOUS les noms de personnes mentionnées
- TOUS les numéros de téléphone (format 06.., 01.., etc.)
- TOUS les emails
- TOUTES les adresses complètes
- Codes d'accès (digicode, interphone, badge)
- Références et numéros de dossier
- Description du problème ou de l'intervention
- Rôles des contacts (gardien, propriétaire, locataire, gestionnaire, occupant)

Les contacts sont CRITIQUES - ne les omets jamais!
Ignore le contenu non pertinent (mentions légales, publicités, signatures génériques).
Réponds avec un résumé concis mais COMPLET pour les contacts."""


def summarize_long_content(content: str, filename: str = "") -> str:
    """
    Résume un contenu trop long via LLM.
    
    Args:
        content: Texte à résumer
        filename: Nom du fichier source (pour logging)
        
    Returns:
        Résumé du contenu ou contenu original si échec
    """
    if len(content) <= MAX_ATTACHMENT_CHARS:
        return content
    
    base_url = os.environ.get('AI_INTEGRATIONS_OPENROUTER_BASE_URL')
    api_key = os.environ.get('AI_INTEGRATIONS_OPENROUTER_API_KEY')
    
    if not base_url or not api_key:
        logger.warning(f"Pas d'API pour résumer {filename}, troncature simple")
        return content[:MAX_ATTACHMENT_CHARS] + "\n[... contenu tronqué ...]"
    
    logger.info(f"Résumé de {filename}: {len(content)} caractères")
    
    try:
        truncated_for_summary = content[:20000]
        
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistralai/ministral-8b-2512",
                "messages": [
                    {"role": "system", "content": SUMMARY_PROMPT},
                    {"role": "user", "content": f"Document ({filename}):\n\n{truncated_for_summary}"}
                ],
                "max_tokens": 1500,
                "temperature": 0.1
            },
            timeout=30
        )
        
        response.raise_for_status()
        data = response.json()
        
        summary = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if summary:
            tokens = data.get("usage", {}).get("total_tokens", 0)
            logger.info(f"Résumé généré: {len(summary)} chars (tokens: {tokens})")
            return f"[Résumé de {len(content)} caractères]\n{summary}"
        
    except Exception as e:
        logger.warning(f"Erreur résumé {filename}: {e}")
    
    return content[:MAX_ATTACHMENT_CHARS] + "\n[... contenu tronqué ...]"


def truncate_content(content: str, max_chars: int = MAX_CONTENT_CHARS) -> str:
    """Tronque le contenu si trop long."""
    if len(content) <= max_chars:
        return content
    logger.warning(f"Contenu tronqué: {len(content)} -> {max_chars} caractères")
    return content[:max_chars] + "\n\n[... contenu tronqué ...]"


CLASSIFICATION_PROMPT = """Tu es un filtre de tri pour une entreprise de travaux bâtiment (étanchéité, plomberie, couverture).

Analyse le sujet et le début du corps de cet email. Réponds UNIQUEMENT par "OUI" ou "NON".

Réponds "OUI" si c'est une DEMANDE D'INTERVENTION ou d'un DEVIS pour des travaux :
- Ordre de service (OS)
- Demande de devis travaux
- Signalement de sinistre, fuite, infiltration
- Demande d'intervention, réparation, diagnostic
- Transfert d'une demande d'intervention

Réponds "NON" si c'est :
- Facture, avoir, relevé de compte
- Newsletter, publicité, offre commerciale
- Email de recrutement, candidature
- Confirmation de rendez-vous déjà pris
- Notification système, alerte de sécurité
- Compte-rendu de réunion, PV d'AG
- Email administratif sans demande de travaux

Réponds UNIQUEMENT "OUI" ou "NON", rien d'autre."""


INTERVENTION_KEYWORDS = [
    'ordre de service', 'os n°', 'os n ', 'o.s.',
    'demande d\'intervention', 'demande intervention',
    'demande de devis', 'devis travaux',
    'sinistre', 'dégât des eaux', 'degat des eaux', 'dégâts des eaux',
    'fuite', 'infiltration', 'inondation',
    'étanchéité', 'etancheite', 'toiture', 'couverture',
    'plomberie', 'canalisation',
    'intervention urgente', 'intervention rapide',
    'bon de commande', 'bon commande',
    'mise en demeure travaux',
    'réparation', 'reparation',
    'diagnostic', 'expertise',
    'pissette', 'acrotère', 'membrane', 'bitume',
    'terrasse', 'balcon',
]

NON_INTERVENTION_KEYWORDS = [
    'facture', 'avoir n°', 'relevé de compte',
    'newsletter', 'se désabonner', 'unsubscribe',
    'candidature', 'cv en pièce jointe', 'recrutement',
    'offre d\'emploi', 'poste à pourvoir',
    'confirmation de rendez-vous',
    'procès-verbal', 'pv d\'ag', 'assemblée générale',
    'joyeux noël', 'bonne année', 'meilleurs voeux',
]


def is_intervention_email_keywords(subject: str, body: str) -> bool:
    combined = f"{subject}\n{body[:2000]}".lower()

    for kw in NON_INTERVENTION_KEYWORDS:
        if kw in combined:
            return False

    for kw in INTERVENTION_KEYWORDS:
        if kw in combined:
            return True

    return False


def is_intervention_email(subject: str, body: str) -> bool:
    base_url = os.environ.get('AI_INTEGRATIONS_OPENROUTER_BASE_URL')
    api_key = os.environ.get('AI_INTEGRATIONS_OPENROUTER_API_KEY')

    if not base_url or not api_key:
        logger.warning("Pas d'API LLM pour classification, fallback mots-clés")
        return is_intervention_email_keywords(subject, body)

    truncated_body = body[:2000]
    user_content = f"Sujet: {subject}\n\nCorps (début):\n{truncated_body}"

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistralai/ministral-8b-2512",
                "messages": [
                    {"role": "system", "content": CLASSIFICATION_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                "max_tokens": 10,
                "temperature": 0.0
            },
            timeout=15
        )

        response.raise_for_status()
        data = response.json()
        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip().upper()
        tokens = data.get("usage", {}).get("total_tokens", 0)
        logger.info(f"Classification LLM: '{answer}' (tokens: {tokens}) pour: {subject[:60]}")

        if "OUI" in answer:
            return True
        elif "NON" in answer:
            return False
        else:
            logger.warning(f"Réponse LLM ambiguë: '{answer}', fallback mots-clés")
            return is_intervention_email_keywords(subject, body)

    except Exception as e:
        logger.warning(f"Erreur classification LLM: {e}, fallback mots-clés")
        return is_intervention_email_keywords(subject, body)


def detect_metier(text: str) -> str:
    """Détecte le métier basé sur les mots-clés."""
    text_lower = text.lower()
    
    etancheite_keywords = [
        'toiture-terrasse', 'terrasse', 'infiltration', 'membrane', 'bitume', 
        'étanchéité', 'etancheite', 'toiture plate', 'fuite toit',
        'pissette', 'évacuation eau pluviale', 'evacuation eau pluviale',
        'évacuation ep', 'evacuation ep', 'descente ep', 'eau pluviale',
        'balcon', 'trop-plein', 'acrotère', 'relevé étanchéité', 'solin'
    ]
    plomberie_keywords = [
        'canalisation', 'wc', 'robinet', 'tuyau', 
        'fuite intérieure', 'plomberie', 'sanitaire', 'eau chaude',
        'chauffe-eau', 'cumulus', 'évier', 'lavabo', 'douche', 'baignoire'
    ]
    couverture_keywords = [
        'tuile', 'ardoise', 'gouttière', 'gouttiere', 'cheminée', 
        'zinc', 'toiture pente', 'couverture', 'chéneau', 'faîtage'
    ]
    
    for kw in etancheite_keywords:
        if kw in text_lower:
            return "Etancheite"
    for kw in plomberie_keywords:
        if kw in text_lower:
            return "Plomberie"
    for kw in couverture_keywords:
        if kw in text_lower:
            return "Couverture"
    
    return "Autre"


def calculate_confidence(result: Dict[str, Any]) -> float:
    """Calcule un score de confiance global basé sur les champs remplis."""
    scores = []
    
    bien = result.get("bien", {})
    bien_fields = [bien.get("adresse"), bien.get("code_postal"), bien.get("ville")]
    bien_score = sum(1 for f in bien_fields if f) / 3
    scores.append(("bien", bien_score, 0.25))
    
    demande = result.get("demande", {})
    demande_fields = [demande.get("objet"), demande.get("metier"), demande.get("urgence")]
    demande_score = sum(1 for f in demande_fields if f) / 3
    scores.append(("demande", demande_score, 0.25))
    
    contacts = result.get("contacts", [])
    contacts_score = min(1.0, len(contacts) * 0.5) if contacts else 0
    scores.append(("contacts", contacts_score, 0.2))
    
    syndic_score = 1.0 if result.get("syndic") else 0
    scores.append(("syndic", syndic_score, 0.2))
    
    codes_score = 1.0 if result.get("codes_acces") else 0.5
    scores.append(("codes_acces", codes_score, 0.1))
    
    global_score = sum(score * weight for _, score, weight in scores)
    
    return round(global_score, 2)


def detect_urgence(text: str) -> str:
    """Évalue l'urgence basée sur les mots-clés (US007).
    
    IMPORTANT: Les demandes de devis sont toujours considérées comme non-urgentes.
    La priorité est donnée aux mots-clés de faible urgence pour éviter les faux positifs.
    """
    text_lower = text.lower()
    
    # Mots-clés d'urgence faible - PRIORITAIRES (devis = jamais urgent)
    faible_keywords = [
        'demande de devis', 'devis', 'chiffrage', 'estimation', 'budget',
        'préventif', 'preventif', 'prévention',
        'contrôle annuel', 'controle annuel',
        'vérification', 'verification', 'visite annuelle',
        'pas de problème', 'pas de fuite', 'pas urgent',
        'à votre convenance', 'quand vous pourrez',
        'pose', 'installation', 'remplacement prévu'
    ]
    
    # Vérifier d'abord les mots-clés de faible urgence (priorité)
    for kw in faible_keywords:
        if kw in text_lower:
            return "Faible"
    
    # Mots-clés d'urgence haute - fuite active, dégâts en cours
    urgent_keywords = [
        'urgent', 'urgence', 'fuite active', 'fuite importante',
        'degats', 'dégâts', 'sinistre', 'eau qui coule', 
        'inondation', 'inonde', 'innonde', 'immédiat', 'immediat',
        'en cours', 'fuite en cours', 'intervention rapide'
    ]
    
    for kw in urgent_keywords:
        if kw in text_lower:
            return "Urgent"
    
    return "Normal"


def extract_basic_info(email_body: str, email_subject: str = "") -> Dict[str, Any]:
    """Extraction basique par regex en cas d'échec LLM."""
    result = create_empty_result()
    
    combined = f"{email_subject}\n{email_body}"
    
    cp_match = re.search(r'\b(\d{5})\b', combined)
    if cp_match:
        result["bien"]["code_postal"] = cp_match.group(1)
    
    tel_match = re.search(r'(?:0[1-9])(?:[\s.-]?\d{2}){4}', combined)
    if tel_match:
        result["contacts"] = [{"nom": None, "telephone": tel_match.group(0).replace(" ", "").replace(".", "").replace("-", ""), "email": None, "qualite": None}]
    
    email_match = re.search(r'[\w.-]+@[\w.-]+\.\w+', combined)
    if email_match:
        if result["contacts"]:
            result["contacts"][0]["email"] = email_match.group(0)
    
    ref_match = re.search(r'(?:ref|réf|dossier|n°|sinistre)[:\s]*([A-Z0-9-]+)', combined, re.IGNORECASE)
    if ref_match:
        result["demande"]["ref_syndic"] = ref_match.group(1)
    
    result["demande"]["metier"] = detect_metier(combined)
    result["demande"]["urgence"] = detect_urgence(combined)
    result["demande"]["objet"] = email_subject[:100] if email_subject else None
    
    result["confiance"]["global"] = calculate_confidence(result)
    
    return result


def create_empty_result() -> Dict[str, Any]:
    """Crée une structure de résultat vide conforme à US004."""
    return {
        "bien": {
            "adresse": None,
            "code_postal": None,
            "ville": None,
            "nom_copropriete": None
        },
        "demande": {
            "objet": None,
            "detail": None,
            "metier": "Etancheite",
            "urgence": "Normal",
            "ref_syndic": None
        },
        "contacts": [],
        "codes_acces": None,
        "syndic": None,
        "gestionnaire": None,
        "confiance": {
            "bien": 0,
            "demande": 0,
            "contacts": 0,
            "codes_acces": 0,
            "syndic": 0,
            "global": 0
        },
        "needs_review": False,
        "tokens_used": 0
    }


def parse_llm_response(content: str) -> Dict[str, Any]:
    """Parse la réponse JSON du LLM avec nettoyage."""
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    
    return json.loads(content)


def normalize_phone(phone: str) -> str:
    """Normalise un numéro de téléphone pour comparaison."""
    if not phone:
        return ""
    # Retirer tout sauf les chiffres
    digits = re.sub(r'[^\d]', '', phone)
    # Gérer le +33 français
    if digits.startswith('33') and len(digits) > 10:
        digits = '0' + digits[2:]
    return digits


def normalize_name(name: str) -> str:
    """Normalise un nom pour comparaison."""
    if not name:
        return ""
    # Minuscule, sans accents basiques, sans ponctuation
    name = name.lower().strip()
    # Remplacer les caractères spéciaux courants
    replacements = [
        ('é', 'e'), ('è', 'e'), ('ê', 'e'), ('ë', 'e'),
        ('à', 'a'), ('â', 'a'), ('ä', 'a'),
        ('ô', 'o'), ('ö', 'o'), ('ù', 'u'), ('û', 'u'), ('ü', 'u'),
        ('ç', 'c'), ('ï', 'i'), ('î', 'i'),
        ("'", ''), ('-', ' '), ('/', ' '), ('  ', ' ')
    ]
    for old, new in replacements:
        name = name.replace(old, new)
    return name.strip()


def names_match(name1: str, name2: str) -> bool:
    """Vérifie si deux noms correspondent (même personne)."""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    
    if not n1 or not n2:
        return False
    
    # Correspondance exacte
    if n1 == n2:
        return True
    
    # Un nom contient l'autre
    if n1 in n2 or n2 in n1:
        return True
    
    # Vérifier si les mots principaux correspondent
    words1 = set(n1.split())
    words2 = set(n2.split())
    
    # Retirer les mots courants non significatifs
    noise = {'et', 'mme', 'mlle', 'mr', 'm', 'madame', 'monsieur'}
    words1 = words1 - noise
    words2 = words2 - noise
    
    # Si au moins un mot significatif en commun
    common = words1 & words2
    if common and len(common) >= 1:
        return True
    
    return False


def deduplicate_contacts(contacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fusionne les contacts en doublon (même téléphone ou noms similaires).
    Garde les informations les plus complètes.
    """
    if not contacts or len(contacts) <= 1:
        return contacts
    
    merged = []
    used = set()
    
    for i, contact in enumerate(contacts):
        if i in used:
            continue
        
        current = dict(contact)
        current_phone = normalize_phone(current.get('telephone', ''))
        current_name = current.get('nom', '')
        
        # Chercher les doublons
        for j, other in enumerate(contacts[i+1:], i+1):
            if j in used:
                continue
            
            other_phone = normalize_phone(other.get('telephone', ''))
            other_name = other.get('nom', '')
            
            is_duplicate = False
            
            # Même numéro de téléphone (non vide)
            if current_phone and other_phone and current_phone == other_phone:
                is_duplicate = True
            # Noms similaires
            elif names_match(current_name, other_name):
                is_duplicate = True
            
            if is_duplicate:
                used.add(j)
                # Fusionner: garder les valeurs non nulles les plus longues
                for key in ['nom', 'telephone', 'email', 'qualite']:
                    val_current = current.get(key) or ''
                    val_other = other.get(key) or ''
                    if len(str(val_other)) > len(str(val_current)):
                        current[key] = other.get(key)
                
                logger.info(f"Contacts fusionnés: '{current_name}' + '{other_name}'")
        
        merged.append(current)
    
    return merged


def parse_email_with_llm(email_body: str, email_subject: str = "", email_from: str = "", 
                         attachment_text: str = "") -> Dict[str, Any]:
    """
    Parse un email avec Mistral pour extraire les données structurées selon US004.
    
    Args:
        email_body: Corps de l'email
        email_subject: Sujet de l'email
        email_from: Expéditeur de l'email
        attachment_text: Texte extrait des pièces jointes
    
    Returns:
        Dict avec structure US004: bien, demande, contacts, codes_acces, syndic, confiance
    """
    base_url = os.environ.get('AI_INTEGRATIONS_OPENROUTER_BASE_URL')
    api_key = os.environ.get('AI_INTEGRATIONS_OPENROUTER_API_KEY')
    
    if not base_url or not api_key:
        logger.error("Variables AI_INTEGRATIONS requises non configurées")
        result = extract_basic_info(email_body, email_subject)
        result["needs_review"] = True
        return result
    
    processed_body = email_body
    if len(email_body) > MAX_BODY_CHARS:
        processed_body = summarize_long_content(email_body, "email_body")
        logger.info(f"Email body résumé: {len(email_body)} -> {len(processed_body)}")
    processed_body = truncate_content(processed_body, MAX_BODY_CHARS)
    
    processed_attachments = ""
    if attachment_text:
        if len(attachment_text) > MAX_TOTAL_ATTACHMENTS:
            processed_attachments = summarize_long_content(attachment_text, "attachments")
            logger.info(f"Attachments résumés: {len(attachment_text)} -> {len(processed_attachments)}")
        else:
            processed_attachments = attachment_text
        processed_attachments = truncate_content(processed_attachments, MAX_TOTAL_ATTACHMENTS)
    
    if processed_attachments:
        full_content = f"{processed_body}\n\n--- PIECES JOINTES ---\n\n{processed_attachments}"
    else:
        full_content = processed_body
    
    full_content = truncate_content(full_content, MAX_CONTENT_CHARS)
    logger.info(f"Contenu final: {len(full_content)} caractères")
    
    user_prompt = f"""Email recu:
---
De: {email_from}
Sujet: {email_subject}

{full_content}
---

Reponds avec un JSON valide uniquement."""
    
    last_error = None
    tokens_used = 0
    
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"Tentative LLM {attempt + 1}/{MAX_RETRIES}")
            
            response = requests.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistralai/ministral-8b-2512",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.1
                },
                timeout=45
            )
            
            response.raise_for_status()
            data = response.json()
            
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            logger.info(f"Tokens utilisés: {tokens_used}")
            
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = parse_llm_response(content)
            
            result = create_empty_result()
            
            if "bien" in parsed and isinstance(parsed["bien"], dict):
                result["bien"].update({k: v for k, v in parsed["bien"].items() if k in result["bien"]})
            
            if "demande" in parsed and isinstance(parsed["demande"], dict):
                result["demande"].update({k: v for k, v in parsed["demande"].items() if k in result["demande"]})
            
            if "contacts" in parsed and isinstance(parsed["contacts"], list):
                # Dédupliquer les contacts (même téléphone ou noms similaires)
                result["contacts"] = deduplicate_contacts(parsed["contacts"])
            
            result["codes_acces"] = parsed.get("codes_acces")
            result["gestionnaire"] = parsed.get("gestionnaire")
            
            # Validation du syndic: vérifier que ce n'est pas un prestataire
            detected_syndic = parsed.get("syndic")
            if detected_syndic and is_contractor(detected_syndic):
                logger.warning(f"Syndic '{detected_syndic}' détecté comme prestataire, recherche alternative")
                # Chercher le syndic dans le contenu
                content_syndic = extract_syndic_from_content(full_content)
                if content_syndic:
                    logger.info(f"Syndic corrigé: '{detected_syndic}' -> '{content_syndic}'")
                    result["syndic"] = content_syndic
                else:
                    result["syndic"] = None
            else:
                result["syndic"] = detected_syndic
            
            if "confiance" in parsed and isinstance(parsed["confiance"], dict):
                result["confiance"].update(parsed["confiance"])
            
            if not result["demande"]["metier"] or result["demande"]["metier"] not in ["Etancheite", "Plomberie", "Couverture", "Autre"]:
                result["demande"]["metier"] = detect_metier(full_content)
            
            if not result["demande"]["urgence"] or result["demande"]["urgence"] not in ["Urgent", "Normal", "Faible"]:
                result["demande"]["urgence"] = detect_urgence(full_content)
            
            global_confidence = result["confiance"].get("global", 0)
            if not global_confidence or global_confidence == 0:
                global_confidence = calculate_confidence(result)
                result["confiance"]["global"] = global_confidence
                logger.info(f"Confiance calculée: {global_confidence}")
            
            if isinstance(global_confidence, (int, float)) and global_confidence < 0.5:
                result["needs_review"] = True
                logger.warning(f"Confiance faible ({global_confidence}): email marqué pour revue")
            
            result["tokens_used"] = tokens_used
            
            return result
            
        except requests.exceptions.Timeout:
            last_error = "Timeout API"
            logger.warning(f"Timeout tentative {attempt + 1}")
            
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else 0
            last_error = f"HTTP {status_code}: {str(e)}"
            logger.warning(f"Erreur HTTP tentative {attempt + 1}: {last_error}")
            
            if status_code == 413:
                current_len = len(full_content)
                if current_len > 15000:
                    logger.warning(f"413: Réduction {current_len} -> 10000")
                    full_content = truncate_content(full_content, max_chars=10000)
                elif current_len > 5000:
                    logger.warning(f"413: Réduction {current_len} -> 5000")
                    full_content = truncate_content(full_content, max_chars=5000)
                else:
                    logger.warning(f"413: Contenu minimal ({current_len}), email body seul")
                    full_content = truncate_content(processed_body, max_chars=3000)
                
                user_prompt = f"""Email recu:
---
De: {email_from}
Sujet: {email_subject}

{full_content}
---

Reponds avec un JSON valide uniquement."""
                continue
            if status_code == 429:
                logger.warning("Quota dépassé")
                time.sleep(RETRY_DELAY * 2)
                continue
                
        except requests.exceptions.RequestException as e:
            last_error = f"Erreur réseau: {str(e)}"
            logger.warning(f"Erreur réseau tentative {attempt + 1}: {last_error}")
            
        except json.JSONDecodeError as e:
            last_error = f"JSON invalide: {str(e)}"
            logger.warning(f"Erreur JSON tentative {attempt + 1}: {last_error}")
        
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
    
    logger.error(f"Échec après {MAX_RETRIES} tentatives: {last_error}")
    result = extract_basic_info(email_body, email_subject)
    result["needs_review"] = True
    result["error"] = last_error
    result["tokens_used"] = tokens_used
    
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    test_email = """
    Bonjour,
    
    Suite à notre conversation téléphonique, je vous confirme notre demande d'intervention
    pour une infiltration sur la toiture-terrasse de l'immeuble situé au 15 rue de la Paix, 75002 Paris.
    
    Référence dossier: SIN-2024-0542
    
    Contact sur place: M. Martin (gardien) - 0612345678
    Digicode: 1234B
    
    Merci de nous contacter pour planifier l'intervention urgente.
    
    Cordialement,
    Marie Dupont
    Gestionnaire - Cabinet Immobilier Martin
    Tel: 01 42 36 58 00
    """
    
    print("Test du parser LLM US004...")
    try:
        result = parse_email_with_llm(
            email_body=test_email,
            email_subject="URGENT - Demande intervention toiture - 15 rue de la Paix",
            email_from="m.dupont@cabinet-martin.fr"
        )
        print(f"Résultat:\n{json.dumps(result, indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"Erreur: {e}")
