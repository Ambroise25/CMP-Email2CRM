"""
CRM API Client - Envoi des données vers l'API Extranet
Avec gestion des retries et backoff exponentiel

API Extranet:
- GET/POST /api/gestionnaires (id, nom, prenom, email, telephone, syndic)
- GET/POST /api/biens (id, adresse, complementAdresse, codePostal, ville, gestionnaireId, information, travauxEnerpur)
- GET/POST /api/demandes (id, numeroOs, titre, description, adresse, client, statut, dateDemande, bienId)
"""

import os
import re
import time
import json
import logging
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime
from email.utils import parsedate_to_datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CRM_API_URL = os.environ.get('CRM_API_URL', 'https://f72ecdeb-c4e8-439a-87c3-8b8a95f00ad5-00-3bk76cl6rjsm5.picard.replit.dev/api')
CRM_API_TIMEOUT = int(os.environ.get('CRM_API_TIMEOUT', '30'))
CRM_API_RETRY_COUNT = int(os.environ.get('CRM_API_RETRY_COUNT', '3'))
CRM_API_RETRY_DELAY = int(os.environ.get('CRM_API_RETRY_DELAY', '5'))

failed_queue: List[Dict[str, Any]] = []


def make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None
) -> Dict[str, Any]:
    url = f"{CRM_API_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    last_error = None
    
    for attempt in range(CRM_API_RETRY_COUNT):
        try:
            logger.info(f"[CRM] {method} {url} (tentative {attempt + 1}/{CRM_API_RETRY_COUNT})")
            
            if method.upper() == "GET":
                response = requests.get(url, params=params, headers=headers, timeout=CRM_API_TIMEOUT)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=CRM_API_TIMEOUT)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=CRM_API_TIMEOUT)
            else:
                raise ValueError(f"Méthode HTTP non supportée: {method}")
            
            if response.status_code in [200, 201]:
                logger.info(f"[CRM] Succès: {response.status_code}")
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "data": response.json() if response.text else {}
                }
            
            elif response.status_code == 400:
                logger.error(f"[CRM] Données invalides (400): {response.text}")
                return {
                    "success": False,
                    "status_code": 400,
                    "error": "Données invalides",
                    "details": response.text,
                    "retry": False
                }
            
            elif response.status_code == 404:
                logger.error(f"[CRM] Endpoint non trouvé (404): {url}")
                return {
                    "success": False,
                    "status_code": 404,
                    "error": "Endpoint non trouvé",
                    "retry": False
                }
            
            elif response.status_code == 429:
                wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
                logger.warning(f"[CRM] Rate limit (429), attente {wait_time}s")
                time.sleep(wait_time)
                last_error = "Rate limit atteint"
                continue
            
            elif response.status_code >= 500:
                wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
                logger.warning(f"[CRM] Erreur serveur ({response.status_code}), attente {wait_time}s")
                time.sleep(wait_time)
                last_error = f"Erreur serveur: {response.status_code}"
                continue
            
            else:
                logger.warning(f"[CRM] Réponse inattendue: {response.status_code}")
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": f"Réponse inattendue: {response.status_code}",
                    "retry": True
                }
                
        except requests.exceptions.Timeout:
            wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
            logger.warning(f"[CRM] Timeout, attente {wait_time}s avant retry")
            time.sleep(wait_time)
            last_error = "Timeout"
            continue
            
        except requests.exceptions.ConnectionError as e:
            wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
            logger.warning(f"[CRM] Erreur de connexion: {e}, attente {wait_time}s")
            time.sleep(wait_time)
            last_error = f"Erreur de connexion: {str(e)}"
            continue
            
        except Exception as e:
            logger.error(f"[CRM] Erreur inattendue: {e}")
            return {
                "success": False,
                "error": str(e),
                "retry": False
            }
    
    logger.error(f"[CRM] Échec après {CRM_API_RETRY_COUNT} tentatives: {last_error}")
    return {
        "success": False,
        "error": last_error or "Échec après plusieurs tentatives",
        "retry": True
    }


def _parse_date_to_iso(date_str: Optional[str]) -> str:
    if not date_str:
        return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo:
            from datetime import timezone
            dt = dt.astimezone(timezone.utc)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        if dt.tzinfo:
            from datetime import timezone
            dt = dt.astimezone(timezone.utc)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    except Exception:
        pass
    return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')


def _normalize(text: str) -> str:
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text.strip().lower())


def _split_name(full_name: str) -> Dict[str, str]:
    if not full_name:
        return {"nom": "", "prenom": ""}
    parts = full_name.strip().split()
    if len(parts) == 1:
        return {"nom": parts[0], "prenom": ""}
    return {"nom": parts[-1], "prenom": " ".join(parts[:-1])}


def find_gestionnaire(email: Optional[str], nom: Optional[str], syndic: Optional[str]) -> Optional[Dict]:
    result = make_request("GET", "/gestionnaires")
    if not result.get("success"):
        return None
    
    gestionnaires = result.get("data", [])
    if not isinstance(gestionnaires, list):
        return None
    
    if email:
        email_lower = email.lower().strip()
        for g in gestionnaires:
            if g.get("email", "").lower().strip() == email_lower:
                logger.info(f"[CRM] Gestionnaire trouvé par email: ID={g['id']} ({g.get('nom')})")
                return g
    
    if nom:
        nom_norm = _normalize(nom)
        for g in gestionnaires:
            g_full = _normalize(f"{g.get('prenom', '')} {g.get('nom', '')}")
            g_nom = _normalize(g.get('nom', ''))
            if nom_norm == g_full or nom_norm == g_nom:
                logger.info(f"[CRM] Gestionnaire trouvé par nom: ID={g['id']} ({g.get('nom')})")
                return g
    
    if syndic:
        syndic_norm = _normalize(syndic)
        matches = [g for g in gestionnaires if syndic_norm in _normalize(g.get("syndic", "")) or _normalize(g.get("syndic", "")) in syndic_norm]
        if len(matches) == 1:
            g = matches[0]
            logger.info(f"[CRM] Gestionnaire trouvé par syndic: ID={g['id']} ({g.get('nom')})")
            return g
    
    return None


def create_gestionnaire(nom: str, prenom: str, email: str, telephone: str, syndic: str) -> Dict[str, Any]:
    data = {
        "nom": nom or "",
        "prenom": prenom or "",
        "email": email or "",
        "telephone": telephone or "",
        "syndic": syndic or ""
    }
    logger.info(f"[CRM] Création gestionnaire: {nom} {prenom} ({syndic})")
    result = make_request("POST", "/gestionnaires", data=data)
    if result.get("success"):
        g = result.get("data", {})
        logger.info(f"[CRM] Gestionnaire créé: ID={g.get('id')}")
        return {"success": True, "gestionnaire_id": g.get("id"), "data": g}
    return {"success": False, "error": result.get("error"), "details": result.get("details")}


def find_bien(adresse: str, code_postal: str) -> Optional[Dict]:
    result = make_request("GET", "/biens")
    if not result.get("success"):
        return None
    
    biens = result.get("data", [])
    if not isinstance(biens, list):
        return None
    
    adresse_norm = _normalize(adresse)
    cp_norm = code_postal.strip() if code_postal else ""
    
    for b in biens:
        b_adresse = _normalize(b.get("adresse", ""))
        b_cp = (b.get("codePostal") or "").strip()
        
        if b_cp == cp_norm and (adresse_norm == b_adresse or adresse_norm in b_adresse or b_adresse in adresse_norm):
            logger.info(f"[CRM] Bien trouvé: ID={b['id']} ({b.get('adresse')})")
            return b
    
    return None


def create_bien(bien_data: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(f"[CRM] Création bien: {bien_data.get('adresse')}")
    result = make_request("POST", "/biens", data=bien_data)
    if result.get("success"):
        data = result.get("data", {})
        bien_id = data.get("id")
        logger.info(f"[CRM] Bien créé: ID={bien_id}")
        return {"success": True, "bien_id": bien_id, "data": data}
    return {"success": False, "error": result.get("error"), "details": result.get("details")}


def create_demande(demande_data: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(f"[CRM] Création demande: {demande_data.get('titre')}")
    result = make_request("POST", "/demandes", data=demande_data)
    if result.get("success"):
        data = result.get("data", {})
        demande_id = data.get("id")
        logger.info(f"[CRM] Demande créée: ID={demande_id}")
        return {"success": True, "demande_id": demande_id, "data": data}
    return {"success": False, "error": result.get("error"), "details": result.get("details")}


def send_to_crm(parsed_data: Dict[str, Any], email_date: Optional[str] = None) -> Dict[str, Any]:
    logger.info("[CRM] === Début envoi vers Extranet ===")
    
    bien_info = parsed_data.get("bien", {})
    if not isinstance(bien_info, dict):
        bien_info = {}
    demande_info = parsed_data.get("demande", {})
    if not isinstance(demande_info, dict):
        demande_info = {}
    
    adresse = bien_info.get("adresse", "")
    code_postal = bien_info.get("code_postal", "")
    ville = bien_info.get("ville", "")
    
    if not adresse:
        logger.error("[CRM] Adresse manquante")
        return {"success": False, "error": "Adresse manquante", "step": "validation"}
    
    syndic_name = parsed_data.get("syndic", "")
    gestionnaire_info = parsed_data.get("gestionnaire", {})
    if not isinstance(gestionnaire_info, dict):
        gestionnaire_info = {}
    
    gest_nom = gestionnaire_info.get("nom", "")
    gest_email = gestionnaire_info.get("email", "")
    gest_tel = gestionnaire_info.get("telephone", "")
    
    gestionnaire_id = None
    gestionnaire_created = False
    
    try:
        existing_gest = find_gestionnaire(gest_email, gest_nom, syndic_name)
        if existing_gest:
            gestionnaire_id = existing_gest.get("id")
            logger.info(f"[CRM] Gestionnaire existant: ID={gestionnaire_id}")
        elif gest_nom or gest_email or syndic_name:
            name_parts = _split_name(gest_nom)
            gest_result = create_gestionnaire(
                nom=name_parts["nom"],
                prenom=name_parts["prenom"],
                email=gest_email,
                telephone=gest_tel,
                syndic=syndic_name
            )
            if gest_result.get("success"):
                gestionnaire_id = gest_result.get("gestionnaire_id")
                gestionnaire_created = True
            else:
                logger.warning(f"[CRM] Échec création gestionnaire: {gest_result.get('error')}")
    except Exception as e:
        logger.warning(f"[CRM] Erreur gestionnaire (non bloquant): {e}")
    
    bien_id = None
    bien_created = False
    
    existing_bien = find_bien(adresse, code_postal)
    if existing_bien:
        bien_id = existing_bien.get("id")
        logger.info(f"[CRM] Bien existant: ID={bien_id}")
    else:
        codes_acces = parsed_data.get("codes_acces", [])
        info_parts = []
        if isinstance(codes_acces, list):
            for ca in codes_acces:
                if isinstance(ca, dict):
                    info_parts.append(f"{ca.get('type', '')}: {ca.get('valeur', '')}".strip(": "))
                elif isinstance(ca, str):
                    info_parts.append(ca)
        lieu_precis = bien_info.get("lieu_precis", "")
        
        bien_data = {
            "adresse": adresse,
            "codePostal": code_postal,
            "ville": ville,
            "complementAdresse": lieu_precis or None,
            "information": ". ".join(info_parts) if info_parts else None,
            "travauxEnerpur": False
        }
        if gestionnaire_id:
            bien_data["gestionnaireId"] = gestionnaire_id
        
        bien_result = create_bien(bien_data)
        if bien_result.get("success"):
            bien_id = bien_result.get("bien_id")
            bien_created = True
        else:
            add_to_queue(parsed_data, email_date, f"Erreur création bien: {bien_result.get('error')}")
            return {
                "success": False,
                "error": bien_result.get("error"),
                "step": "create_bien",
                "queued": True
            }
    
    objet = demande_info.get("objet", "")
    detail = demande_info.get("detail", "")
    ref_syndic = demande_info.get("ref_syndic", "")
    
    titre = objet or detail or "Demande d'intervention"
    if len(titre) > 200:
        titre = titre[:197] + "..."
    
    adresse_complete = adresse
    if code_postal or ville:
        adresse_complete = f"{adresse}, {code_postal} {ville}".strip(", ")
    
    client_name = syndic_name
    contacts = parsed_data.get("contacts", [])
    if isinstance(contacts, list):
        for c in contacts:
            if isinstance(c, dict) and c.get("qualite") in ["copropriétaire", "propriétaire", "locataire"]:
                client_name = c.get("nom", client_name)
                break
    
    demande_data = {
        "titre": titre,
        "description": detail or "",
        "numeroOs": ref_syndic or "",
        "adresse": adresse_complete,
        "client": client_name or "",
    }
    if bien_id:
        demande_data["bienId"] = bien_id
    
    demande_result = create_demande(demande_data)
    if not demande_result.get("success"):
        add_to_queue(parsed_data, email_date, f"Erreur création demande: {demande_result.get('error')}")
        return {
            "success": False,
            "error": demande_result.get("error"),
            "step": "create_demande",
            "bien_id": bien_id,
            "bien_created": bien_created,
            "queued": True
        }
    
    logger.info("[CRM] === Envoi Extranet réussi ===")
    
    return {
        "success": True,
        "bien_id": bien_id,
        "bien_created": bien_created,
        "gestionnaire_id": gestionnaire_id,
        "gestionnaire_created": gestionnaire_created,
        "demande_id": demande_result.get("demande_id"),
        "message": f"Demande créée avec succès (bien {'créé' if bien_created else 'existant'}, gestionnaire {'créé' if gestionnaire_created else 'existant' if gestionnaire_id else 'non défini'})"
    }


def add_to_queue(parsed_data: Dict[str, Any], email_date: Optional[str], error: str) -> None:
    entry = {
        "id": len(failed_queue) + 1,
        "parsed_data": parsed_data,
        "email_date": email_date,
        "error": error,
        "created_at": datetime.now().isoformat(),
        "retry_count": 0
    }
    failed_queue.append(entry)
    logger.info(f"[CRM] Ajouté à la queue (ID={entry['id']}): {error}")


def get_queue() -> List[Dict[str, Any]]:
    return failed_queue.copy()


def retry_queue_item(item_id: int) -> Dict[str, Any]:
    for i, item in enumerate(failed_queue):
        if item.get("id") == item_id:
            logger.info(f"[CRM] Retry queue item ID={item_id}")
            result = send_to_crm(item["parsed_data"], item.get("email_date"))
            if result.get("success"):
                failed_queue.pop(i)
                return result
            else:
                item["retry_count"] = item.get("retry_count", 0) + 1
                item["last_error"] = result.get("error")
                item["last_retry"] = datetime.now().isoformat()
                return result
    return {"success": False, "error": f"Item {item_id} non trouvé dans la queue"}


def clear_queue() -> Dict[str, Any]:
    count = len(failed_queue)
    failed_queue.clear()
    return {"success": True, "cleared": count}


def get_crm_status() -> Dict[str, Any]:
    try:
        response = requests.get(f"{CRM_API_URL}/demandes", timeout=5)
        return {
            "available": response.status_code == 200,
            "url": CRM_API_URL,
            "status_code": response.status_code
        }
    except Exception as e:
        return {
            "available": False,
            "url": CRM_API_URL,
            "error": str(e)
        }


def upload_file(file_path: str, filename: str, content_type: str, demande_id: int) -> Dict[str, Any]:
    import os
    
    if not os.path.exists(file_path):
        return {"success": False, "error": "Fichier introuvable"}
    
    url = f"{CRM_API_URL}/fichiers"
    
    for attempt in range(CRM_API_RETRY_COUNT):
        try:
            logger.info(f"[CRM] Upload fichier: {filename} pour demande_id={demande_id} (tentative {attempt + 1})")
            
            with open(file_path, 'rb') as f:
                files = {'file': (filename, f, content_type)}
                data = {'demande_id': demande_id}
                response = requests.post(url, files=files, data=data, timeout=60)
            
            if response.status_code in [200, 201]:
                result = response.json()
                logger.info(f"[CRM] Fichier uploadé: {filename} -> ID={result.get('id')}")
                return {"success": True, "fichier_id": result.get("id"), "nom": filename}
            elif response.status_code == 413:
                return {"success": False, "nom": filename, "error": "Fichier trop volumineux"}
            elif response.status_code >= 500:
                wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
                time.sleep(wait_time)
                continue
            else:
                return {"success": False, "nom": filename, "error": f"HTTP {response.status_code}: {response.text[:200]}"}
                
        except requests.exceptions.Timeout:
            wait_time = CRM_API_RETRY_DELAY * (2 ** attempt)
            time.sleep(wait_time)
            continue
        except Exception as e:
            return {"success": False, "nom": filename, "error": str(e)}
    
    return {"success": False, "nom": filename, "error": "Échec après plusieurs tentatives"}


def upload_all_files(pieces_jointes: List[Dict[str, Any]], demande_id: int) -> Dict[str, Any]:
    if not pieces_jointes:
        return {"uploaded": [], "count": 0, "errors": []}
    
    uploaded = []
    errors = []
    
    for pj in pieces_jointes:
        chemin = pj.get("chemin_local")
        if not chemin:
            errors.append({"nom": pj.get("nom", "unknown"), "error": "Chemin manquant"})
            continue
        
        result = upload_file(
            file_path=chemin,
            filename=pj.get("nom", "attachment"),
            content_type=pj.get("type", "application/octet-stream"),
            demande_id=demande_id
        )
        
        if result.get("success"):
            uploaded.append({"nom": result["nom"], "fichier_id": result["fichier_id"]})
        else:
            errors.append({"nom": result.get("nom", "unknown"), "error": result.get("error", "Erreur inconnue")})
    
    logger.info(f"[CRM] Upload terminé: {len(uploaded)} réussis, {len(errors)} erreurs")
    return {"uploaded": uploaded, "count": len(uploaded), "errors": errors}
