"""
Processeur de pièces jointes pour Email2Extranet - US008
Extraction de texte depuis PDF et analyse d'images
Stockage temporaire, upload vers CRM, nettoyage automatique
"""

import base64
import io
import os
import json
import shutil
import requests
import logging
from typing import Dict, Any, List, Optional
import pdfplumber

logger = logging.getLogger('attachment-processor')

# Limites US008
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_FILES = 20
ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
TEMP_DIR = '/tmp/email-parser/attachments'

try:
    from llm_parser import summarize_long_content
except ImportError:
    def summarize_long_content(content: str, filename: str = "") -> str:
        """Fallback si import échoue - troncature simple."""
        if len(content) <= 5000:
            return content
        return content[:5000] + "\n[... contenu tronqué ...]"


def extract_text_from_pdf(content_base64: str) -> str:
    """
    Extrait le texte d'un PDF encodé en base64.
    
    Args:
        content_base64: Contenu du PDF en base64
        
    Returns:
        Texte extrait du PDF
    """
    try:
        pdf_bytes = base64.b64decode(content_base64)
        pdf_file = io.BytesIO(pdf_bytes)
        
        text_parts = []
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        
        return "\n\n".join(text_parts)
    
    except Exception as e:
        return f"[Erreur extraction PDF: {str(e)}]"


def analyze_image_with_llm(content_base64: str, content_type: str, filename: str) -> str:
    """
    Analyse une image avec un LLM vision pour extraire les informations textuelles.
    Utilise l'intégration OpenRouter de Replit.
    
    Args:
        content_base64: Contenu de l'image en base64
        content_type: Type MIME (image/jpeg, image/png, etc.)
        filename: Nom du fichier
        
    Returns:
        Description et texte extrait de l'image
    """
    base_url = os.environ.get('AI_INTEGRATIONS_OPENROUTER_BASE_URL')
    api_key = os.environ.get('AI_INTEGRATIONS_OPENROUTER_API_KEY')
    
    if not base_url or not api_key:
        return "[Analyse d'image non disponible - intégration OpenRouter non configurée]"
    
    try:
        data_url = f"data:{content_type};base64,{content_base64}"
        
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemini-2.0-flash-001",
                "messages": [
                    {
                        "role": "system",
                        "content": """Tu es un assistant spécialisé dans l'extraction d'informations depuis des images.
                    
Ton objectif est d'extraire TOUT le texte visible dans l'image et de décrire les éléments pertinents.

Pour les documents scannés ou photos de documents :
- Extrais tout le texte lisible
- Note les références, numéros, dates, adresses

Pour les photos de bâtiments ou dégâts :
- Décris ce que tu vois
- Note les indices sur la localisation
- Décris les dommages ou problèmes visibles

Réponds en français."""
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Analyse cette image (fichier: {filename}). Extrais tout texte visible et décris les éléments importants."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": data_url
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 1000,
                "temperature": 0.2
            },
            timeout=60
        )
        
        response.raise_for_status()
        result = response.json()
        
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        return content or "[Aucune information extraite]"
    
    except requests.exceptions.Timeout:
        return "[Erreur analyse image: Timeout - l'analyse a pris trop de temps]"
    except requests.exceptions.RequestException as e:
        return f"[Erreur analyse image: {str(e)}]"
    except Exception as e:
        return f"[Erreur analyse image: {str(e)}]"


def process_attachments(attachments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Traite toutes les pièces jointes et extrait leur contenu.
    
    Args:
        attachments: Liste des pièces jointes avec content_base64
        
    Returns:
        Dict avec:
        - processed: Liste des résultats de traitement
        - combined_text: Texte combiné de toutes les pièces jointes
    """
    if not attachments:
        return {"processed": [], "combined_text": ""}
    
    processed = []
    text_parts = []
    
    for attachment in attachments:
        filename = attachment.get("filename", "unknown")
        content_type = attachment.get("content_type", "")
        content_base64 = attachment.get("content_base64", "")
        
        if not content_base64:
            continue
        
        result = {
            "filename": filename,
            "content_type": content_type,
            "size": attachment.get("size", 0)
        }
        
        if content_type == "application/pdf":
            extracted_text = extract_text_from_pdf(content_base64)
            processed_text = summarize_long_content(extracted_text, filename)
            result["extracted_text"] = processed_text
            result["original_length"] = len(extracted_text)
            result["was_summarized"] = len(extracted_text) > 5000
            text_parts.append(f"=== Contenu du PDF '{filename}' ===\n{processed_text}")
            
        elif content_type.startswith("image/"):
            analysis = analyze_image_with_llm(content_base64, content_type, filename)
            result["analysis"] = analysis
            text_parts.append(f"=== Analyse de l'image '{filename}' ===\n{analysis}")
        
        processed.append(result)
    
    return {
        "processed": processed,
        "combined_text": "\n\n".join(text_parts)
    }


def validate_attachment(attachment: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valide une pièce jointe selon les limites US008.
    
    Returns:
        Dict avec: valid, error (si invalide)
    """
    filename = attachment.get("filename", "unknown")
    content_type = attachment.get("content_type", "")
    size = attachment.get("size", 0)
    
    # Vérifier la taille
    if size > MAX_FILE_SIZE:
        return {
            "valid": False, 
            "error": f"Fichier trop volumineux: {size / (1024*1024):.1f}MB (max: 10MB)"
        }
    
    # Vérifier le type - accepter image/* et les types spécifiques
    type_allowed = (
        content_type.startswith("image/") or 
        content_type == "application/pdf" or
        content_type in ALLOWED_TYPES
    )
    
    if not type_allowed:
        return {
            "valid": False,
            "error": f"Type non autorisé: {content_type}"
        }
    
    return {"valid": True}


def store_attachment_to_disk(attachment: Dict[str, Any], email_id: str) -> Dict[str, Any]:
    """
    Stocke une pièce jointe sur le disque temporaire.
    
    Args:
        attachment: Dict avec content_base64, filename, content_type, size
        email_id: Identifiant de l'email (pour le dossier)
        
    Returns:
        Dict avec: success, chemin_local, nom, type, taille, error
    """
    filename = attachment.get("filename", "attachment")
    content_type = attachment.get("content_type", "application/octet-stream")
    size = attachment.get("size", 0)
    content_base64 = attachment.get("content_base64", "")
    
    # Valider
    validation = validate_attachment(attachment)
    if not validation["valid"]:
        return {
            "success": False,
            "nom": filename,
            "type": content_type,
            "taille": size,
            "error": validation["error"]
        }
    
    # Créer le dossier pour cet email
    safe_email_id = email_id.replace("/", "_").replace("\\", "_").replace(":", "_")
    email_dir = os.path.join(TEMP_DIR, f"msg-{safe_email_id}")
    os.makedirs(email_dir, exist_ok=True)
    
    # Sauvegarder le fichier
    safe_filename = filename.replace("/", "_").replace("\\", "_")
    file_path = os.path.join(email_dir, safe_filename)
    
    try:
        file_bytes = base64.b64decode(content_base64)
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        
        logger.info(f"Fichier stocké: {file_path} ({size} bytes)")
        
        return {
            "success": True,
            "nom": filename,
            "type": content_type,
            "taille": size,
            "chemin_local": file_path
        }
        
    except Exception as e:
        logger.error(f"Erreur stockage {filename}: {e}")
        return {
            "success": False,
            "nom": filename,
            "type": content_type,
            "taille": size,
            "error": str(e)
        }


def store_all_attachments(attachments: List[Dict[str, Any]], email_id: str) -> Dict[str, Any]:
    """
    Stocke toutes les pièces jointes d'un email (avec limite de 20).
    
    Returns:
        Dict avec: pieces_jointes (liste), count, errors
    """
    if not attachments:
        return {"pieces_jointes": [], "count": 0, "errors": []}
    
    # Limiter à MAX_FILES
    if len(attachments) > MAX_FILES:
        logger.warning(f"Trop de pièces jointes: {len(attachments)} -> limité à {MAX_FILES}")
        attachments = attachments[:MAX_FILES]
    
    pieces_jointes = []
    errors = []
    
    for attachment in attachments:
        result = store_attachment_to_disk(attachment, email_id)
        
        if result["success"]:
            pieces_jointes.append({
                "nom": result["nom"],
                "type": result["type"],
                "taille": result["taille"],
                "chemin_local": result["chemin_local"]
            })
        else:
            errors.append({
                "nom": result["nom"],
                "error": result.get("error", "Erreur inconnue")
            })
    
    return {
        "pieces_jointes": pieces_jointes,
        "count": len(pieces_jointes),
        "errors": errors
    }


def cleanup_email_attachments(email_id: str) -> bool:
    """
    Supprime les fichiers temporaires d'un email après upload.
    
    Returns:
        True si nettoyage réussi
    """
    safe_email_id = email_id.replace("/", "_").replace("\\", "_").replace(":", "_")
    email_dir = os.path.join(TEMP_DIR, f"msg-{safe_email_id}")
    
    if os.path.exists(email_dir):
        try:
            shutil.rmtree(email_dir)
            logger.info(f"Nettoyage effectué: {email_dir}")
            return True
        except Exception as e:
            logger.error(f"Erreur nettoyage {email_dir}: {e}")
            return False
    
    return True


def cleanup_all_temp_attachments() -> Dict[str, Any]:
    """
    Nettoie tous les fichiers temporaires (maintenance).
    
    Returns:
        Dict avec: deleted_count, errors
    """
    if not os.path.exists(TEMP_DIR):
        return {"deleted_count": 0, "errors": []}
    
    deleted = 0
    errors = []
    
    for item in os.listdir(TEMP_DIR):
        item_path = os.path.join(TEMP_DIR, item)
        try:
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
                deleted += 1
            else:
                os.remove(item_path)
                deleted += 1
        except Exception as e:
            errors.append({"path": item_path, "error": str(e)})
    
    logger.info(f"Nettoyage global: {deleted} éléments supprimés")
    return {"deleted_count": deleted, "errors": errors}


if __name__ == "__main__":
    print("Test du processeur de pièces jointes (US008)...")
    print("Ce module nécessite des pièces jointes réelles pour être testé.")
