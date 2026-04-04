"""
Email Parser API - Email2Extranet
Point d'entrée Flask pour l'API de lecture d'emails
"""

import threading
import time
import logging
import uuid
import json
import os
import hashlib
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from imap_client import test_connection, fetch_one_unread_email, fetch_all_unread_emails, archive_email, unarchive_email
from llm_parser import parse_email_with_llm, extract_forwarded_content, detect_syndic_from_domain, extract_syndic_from_content, is_contractor, is_intervention_email
from attachment_processor import process_attachments, store_all_attachments, cleanup_email_attachments
from crm_client import send_to_crm, get_queue, retry_queue_item, clear_queue, get_crm_status, upload_all_files
from url_extractor import extract_all_urls_content

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('email-parser-api')

app = Flask(__name__)
CORS(app)

parsed_demandes = []
parsed_demandes_lock = threading.Lock()

skipped_message_ids = set()
skipped_message_ids_lock = threading.Lock()

PROCESSED_IDS_FILE = '/tmp/email-parser/parsed_message_ids.json'
PROCESSED_IDS_MAX = 1000
processed_message_ids_list = []
processed_message_ids_set = set()
processed_message_ids_lock = threading.Lock()

def load_processed_ids():
    """Charge les message_id déjà traités depuis le fichier persistant."""
    global processed_message_ids_list, processed_message_ids_set
    try:
        if os.path.exists(PROCESSED_IDS_FILE):
            with open(PROCESSED_IDS_FILE, 'r') as f:
                ids = json.load(f)
            processed_message_ids_list = list(ids)[-PROCESSED_IDS_MAX:]
            processed_message_ids_set = set(processed_message_ids_list)
            logger.info(f"Cache persistant chargé: {len(processed_message_ids_set)} message_id(s)")
    except Exception as e:
        logger.warning(f"Erreur chargement cache persistant: {e}")
        processed_message_ids_list = []
        processed_message_ids_set = set()

def save_processed_id(message_id: str):
    """Ajoute un message_id au cache persistant et sauvegarde sur disque."""
    if not message_id:
        return
    with processed_message_ids_lock:
        if message_id in processed_message_ids_set:
            return
        processed_message_ids_list.append(message_id)
        processed_message_ids_set.add(message_id)
        if len(processed_message_ids_list) > PROCESSED_IDS_MAX:
            evicted = processed_message_ids_list.pop(0)
            processed_message_ids_set.discard(evicted)
        snapshot = list(processed_message_ids_list)
    try:
        os.makedirs(os.path.dirname(PROCESSED_IDS_FILE), exist_ok=True)
        with open(PROCESSED_IDS_FILE, 'w') as f:
            json.dump(snapshot, f)
    except Exception as e:
        logger.warning(f"Erreur sauvegarde cache persistant: {e}")

def is_already_processed(message_id: str) -> bool:
    """Vérifie si un message_id a déjà été traité (cache persistant)."""
    if not message_id:
        return False
    with processed_message_ids_lock:
        return message_id in processed_message_ids_set

load_processed_ids()

parsing_lock = threading.Lock()

# État du polling
polling_state = {
    "enabled": False,
    "interval_seconds": 300,
    "last_check": None,
    "next_check": None,
    "emails_found": 0,
    "emails_parsed": 0,
    "last_error": None,
    "thread": None,
    "is_processing": False
}


SKIP_SENDERS = [
    'no-reply@accounts.google.com',
    'noreply@google.com',
    'mailer-daemon@',
    'postmaster@',
]

SKIP_SUBJECTS = [
    'alerte de sécurité',
    'security alert',
    'connexion depuis',
    'sign-in from',
    'verify your email',
    'vérifiez votre',
]

def should_skip_email(email_data):
    """Vérifie si l'email doit être ignoré (non pertinent)."""
    sender = (email_data.get('from', '') or '').lower()
    subject = (email_data.get('subject', '') or '').lower()
    
    for skip_sender in SKIP_SENDERS:
        if skip_sender in sender:
            return True
    
    for skip_subject in SKIP_SUBJECTS:
        if skip_subject in subject:
            return True
    
    return False


def parse_single_email(email_data):
    """Parse un seul email et retourne le résultat structuré."""
    if should_skip_email(email_data):
        logger.info(f"Email ignoré (non pertinent): {email_data.get('subject', 'N/A')}")
        return {"skipped": True, "reason": "Email non pertinent (notification système)"}

    subject = email_data.get('subject', '') or ''
    body = email_data.get('body', '') or ''
    if not is_intervention_email(subject, body):
        logger.info(f"Email ignoré (pas une intervention): {subject[:60]}")
        return {"skipped": True, "reason": "Email non pertinent (pas une demande d'intervention)"}

    email_body_raw = email_data.get('body', '')
    email_html = email_data.get('body_html', '')
    email_id = email_data.get('email_id', 'unknown')
    attachments = email_data.get('attachments', [])
    attachment_text = ""
    url_text = ""
    processed_attachments = []
    pieces_jointes = []
    url_sources = []

    forward_result = extract_forwarded_content(email_body_raw)
    is_forwarded = forward_result['is_forwarded']
    email_body = forward_result['original_content']
    detected_syndic = None

    if is_forwarded:
        original_domain = forward_result.get('original_domain')
        if original_domain:
            detected_syndic = detect_syndic_from_domain(original_domain)
        logger.info(f"Email transféré détecté. Domaine: {original_domain}, Syndic: {detected_syndic}")

    url_result = extract_all_urls_content(email_body, email_html)
    if url_result.get('combined_text'):
        url_text = url_result['combined_text']
        url_sources = url_result.get('sources', [])
        logger.info(f"URLs: {len(url_text)} chars, {len(url_sources)} source(s)")
        
        if not detected_syndic:
            content_syndic = extract_syndic_from_content(url_text)
            if content_syndic:
                detected_syndic = content_syndic
                logger.info(f"Syndic détecté depuis URL: {detected_syndic}")

    if attachments:
        logger.info(f"Traitement de {len(attachments)} PJ")
        result = process_attachments(attachments)
        attachment_text = result.get("combined_text", "")
        processed_attachments = result.get("processed", [])

        storage_result = store_all_attachments(attachments, email_id)
        pieces_jointes = storage_result.get("pieces_jointes", [])

    combined_external_text = "\n\n".join(filter(None, [attachment_text, url_text]))

    parsed_data = parse_email_with_llm(
        email_body=email_body,
        email_subject=email_data.get('subject', ''),
        email_from=email_data.get('from', ''),
        attachment_text=combined_external_text
    )

    parsed_data["pieces_jointes"] = pieces_jointes
    parsed_data["url_sources"] = url_sources

    if detected_syndic and (not parsed_data.get("syndic") or is_contractor(parsed_data.get("syndic", ""))):
        logger.info(f"Syndic corrigé: '{parsed_data.get('syndic')}' -> '{detected_syndic}'")
        parsed_data["syndic"] = detected_syndic

    return {
        "parsed": parsed_data,
        "is_forwarded": is_forwarded,
        "attachments_processed": len(processed_attachments),
        "processed_attachments": processed_attachments,
        "pieces_jointes": pieces_jointes,
        "url_sources": url_sources
    }


def auto_parse_emails() -> bool:
    """Récupère et parse automatiquement tous les emails non lus.
    Returns True if parsing ran, False if skipped (already running)."""
    global polling_state
    
    if not parsing_lock.acquire(blocking=False):
        logger.info("auto_parse_emails déjà en cours, skip")
        return False
    
    try:
        polling_state["is_processing"] = True
        emails = fetch_all_unread_emails(limit=20)
        polling_state["emails_found"] = len(emails)
        
        if not emails:
            logger.info("Polling: aucun email non lu")
            return
        
        logger.info(f"Polling: {len(emails)} email(s) à traiter")
        
        for email_data in emails:
            email_id = email_data.get('email_id', 'unknown')
            message_id = email_data.get('message_id', '')
            if not message_id:
                fallback_key = hashlib.md5(
                    f"{email_data.get('from','')}{email_data.get('date','')}{email_data.get('subject','')}".encode()
                ).hexdigest()
                message_id = f"<fallback-{fallback_key}>"
            
            if is_already_processed(message_id):
                logger.debug(f"Email {email_id} déjà traité (cache persistant), skip")
                continue

            with parsed_demandes_lock:
                already_parsed = any(
                    d.get('message_id') == message_id and message_id 
                    for d in parsed_demandes
                )
            
            if already_parsed:
                logger.info(f"Email {email_id} déjà parsé, skip")
                continue

            if message_id:
                with skipped_message_ids_lock:
                    if message_id in skipped_message_ids:
                        logger.debug(f"Email {email_id} déjà classifié non-intervention, skip")
                        continue
            
            try:
                logger.info(f"Auto-parsing email: {email_data.get('subject', '?')}")
                result = parse_single_email(email_data)
                
                if result.get("skipped"):
                    logger.info(f"Email ignoré: {result.get('reason', 'non pertinent')}")
                    if message_id:
                        with skipped_message_ids_lock:
                            skipped_message_ids.add(message_id)
                        save_processed_id(message_id)
                    continue
                
                parsed_data = result.get("parsed")
                has_parse_error = (
                    parsed_data is None
                    or parsed_data.get("error")
                    or not parsed_data.get("bien", {}).get("adresse")
                )

                archived = False
                archive_folder = None
                if has_parse_error:
                    logger.info(f"Email {email_id} non archivé (parsing dégradé/erreur)")
                    status_value = "error" if parsed_data is None or parsed_data.get("error") else "parsed"
                else:
                    try:
                        archive_result = archive_email(email_id)
                        if archive_result.get("success"):
                            archived = True
                            archive_folder = archive_result.get("folder")
                            logger.info(f"Email {email_id} archivé automatiquement après parsing")
                        else:
                            logger.warning(f"Échec archivage auto email {email_id}: {archive_result.get('error')}")
                    except Exception as arch_err:
                        logger.warning(f"Erreur archivage auto email {email_id}: {arch_err}")
                    status_value = "parsed"

                duplicate_type = None
                duplicate_of = None
                ref_syndic = (parsed_data or {}).get("demande", {}).get("ref_syndic")
                if ref_syndic and parsed_data:
                    urgence_order = {"Faible": 0, "Normal": 1, "Urgent": 2}
                    new_urgence = (parsed_data.get("demande", {}).get("urgence") or "Normal")
                    new_urgence_level = urgence_order.get(new_urgence, 1)

                    with parsed_demandes_lock:
                        origin = None
                        max_existing_urgence = -1
                        for d in reversed(parsed_demandes):
                            d_parsed = d.get("parsed")
                            if not d_parsed:
                                continue
                            d_ref = d_parsed.get("demande", {}).get("ref_syndic")
                            if d_ref and d_ref.strip().lower() == ref_syndic.strip().lower():
                                if origin is None:
                                    origin = d
                                d_urgence = d_parsed.get("demande", {}).get("urgence") or "Normal"
                                d_urgence_level = urgence_order.get(d_urgence, 1)
                                if d_urgence_level > max_existing_urgence:
                                    max_existing_urgence = d_urgence_level
                        if origin is not None:
                            if new_urgence_level > max_existing_urgence:
                                duplicate_type = "relance"
                            else:
                                duplicate_type = "doublon"
                            duplicate_of = origin.get("id")
                            logger.info(f"Doublon détecté: OS '{ref_syndic}' -> {duplicate_type} (de {duplicate_of})")

                demande = {
                    "id": str(uuid.uuid4()),
                    "email_id": email_id,
                    "message_id": message_id,
                    "email_from": email_data.get('from', ''),
                    "email_subject": email_data.get('subject', ''),
                    "email_date": email_data.get('date', ''),
                    "parsed_at": datetime.now().isoformat(),
                    "parsed": parsed_data,
                    "is_forwarded": result.get("is_forwarded", False),
                    "status": status_value,
                    "crm_result": None,
                    "archived": archived,
                    "archive_folder": archive_folder,
                    "duplicate_type": duplicate_type,
                    "duplicate_of": duplicate_of
                }
                
                with parsed_demandes_lock:
                    parsed_demandes.insert(0, demande)
                
                save_processed_id(message_id)
                polling_state["emails_parsed"] = polling_state.get("emails_parsed", 0) + 1
                logger.info(f"Email parsé avec succès: {email_data.get('subject', '?')}")
                
            except Exception as e:
                logger.error(f"Erreur parsing email {email_id}: {e}")
                demande = {
                    "id": str(uuid.uuid4()),
                    "email_id": email_id,
                    "message_id": message_id,
                    "email_from": email_data.get('from', ''),
                    "email_subject": email_data.get('subject', ''),
                    "email_date": email_data.get('date', ''),
                    "parsed_at": datetime.now().isoformat(),
                    "parsed": None,
                    "is_forwarded": False,
                    "status": "error",
                    "error": str(e),
                    "crm_result": None,
                    "archived": False,
                    "archive_folder": None,
                    "duplicate_type": None,
                    "duplicate_of": None
                }
                with parsed_demandes_lock:
                    parsed_demandes.insert(0, demande)
                save_processed_id(message_id)
                    
    except Exception as e:
        polling_state["last_error"] = str(e)
        logger.error(f"Erreur auto_parse_emails: {e}")
    finally:
        polling_state["is_processing"] = False
        parsing_lock.release()
    return True


def polling_worker():
    """Worker thread pour le polling périodique des emails avec auto-parsing"""
    global polling_state
    logger.info("Démarrage du worker de polling IMAP (auto-parse)")
    
    while polling_state["enabled"]:
        try:
            polling_state["last_check"] = datetime.now().isoformat()
            logger.info("Polling: Vérification et parsing automatique...")
            
            auto_parse_emails()
            polling_state["last_error"] = None
                
        except Exception as e:
            polling_state["last_error"] = str(e)
            logger.error(f"Polling: Exception - {str(e)}")
        
        next_time = datetime.now().timestamp() + polling_state["interval_seconds"]
        polling_state["next_check"] = datetime.fromtimestamp(next_time).isoformat()
        
        for _ in range(polling_state["interval_seconds"]):
            if not polling_state["enabled"]:
                break
            time.sleep(1)
    
    logger.info("Worker de polling arrêté")


@app.route('/api/health', methods=['GET'])
def health():
    """Endpoint de santé"""
    return jsonify({"status": "ok", "service": "email-parser"})


@app.route('/api/imap/test', methods=['GET'])
def test_imap():
    """
    Teste la connexion IMAP.
    
    Returns:
        JSON avec statut de connexion, nombre d'emails, etc.
    """
    try:
        result = test_connection()
        return jsonify(result)
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)}), 500


@app.route('/api/emails/unread', methods=['GET'])
def get_one_unread():
    """
    Récupère UN email non lu.
    
    Returns:
        JSON avec le contenu de l'email ou message si aucun non lu.
    """
    try:
        email_data = fetch_one_unread_email()
        
        if email_data:
            return jsonify({
                "success": True,
                "email": email_data
            })
        else:
            return jsonify({
                "success": True,
                "email": None,
                "message": "Aucun email non lu trouvé"
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/emails/unread/all', methods=['GET'])
def get_all_unread():
    """
    Récupère TOUS les emails non lus.
    
    Returns:
        JSON avec la liste des emails.
    """
    try:
        emails = fetch_all_unread_emails(limit=20)
        return jsonify({
            "success": True,
            "emails": emails,
            "count": len(emails)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/emails/parse', methods=['POST'])
def parse_email():
    """Parse un email avec le LLM (utilisé aussi par l'auto-parsing)."""
    try:
        data = request.get_json()
        
        if not data or not data.get('body'):
            return jsonify({
                "success": False,
                "error": "Le corps de l'email (body) est requis"
            }), 400
        
        result = parse_single_email(data)
        
        return jsonify({
            "success": True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Erreur parsing: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/demandes', methods=['GET'])
def get_demandes():
    """Retourne toutes les demandes parsées."""
    with parsed_demandes_lock:
        return jsonify({
            "success": True,
            "demandes": parsed_demandes,
            "count": len(parsed_demandes)
        })


@app.route('/api/demandes/<demande_id>', methods=['GET'])
def get_demande(demande_id):
    """Retourne une demande parsée par son ID."""
    with parsed_demandes_lock:
        for d in parsed_demandes:
            if d["id"] == demande_id:
                return jsonify({"success": True, "demande": d})
    return jsonify({"success": False, "error": "Demande non trouvée"}), 404


@app.route('/api/demandes/clear', methods=['POST'])
def clear_demandes():
    """Vide la liste des demandes parsées."""
    with parsed_demandes_lock:
        parsed_demandes.clear()
    return jsonify({"success": True, "message": "Demandes effacées"})


@app.route('/api/emails/fetch-and-parse', methods=['POST'])
def fetch_and_parse():
    """Récupère et parse tous les emails non lus immédiatement."""
    try:
        started = auto_parse_emails()
        if not started:
            return jsonify({
                "success": False,
                "error": "Un traitement est déjà en cours, veuillez patienter"
            }), 409
        with parsed_demandes_lock:
            count = len(parsed_demandes)
        return jsonify({
            "success": True,
            "message": f"{polling_state['emails_found']} email(s) traité(s)",
            "total_demandes": count
        })
    except Exception as e:
        logger.error(f"Erreur fetch-and-parse: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/polling/status', methods=['GET'])
def get_polling_status():
    """
    Retourne le statut du polling automatique.
    """
    return jsonify({
        "enabled": polling_state["enabled"],
        "interval_seconds": polling_state["interval_seconds"],
        "last_check": polling_state["last_check"],
        "next_check": polling_state["next_check"],
        "emails_found": polling_state["emails_found"],
        "emails_parsed": polling_state.get("emails_parsed", 0),
        "is_processing": polling_state.get("is_processing", False),
        "last_error": polling_state["last_error"]
    })


@app.route('/api/polling/start', methods=['POST'])
def start_polling():
    """
    Démarre le polling automatique des emails.
    
    Body JSON optionnel:
        - interval_seconds: Intervalle en secondes (défaut: 300 = 5 minutes)
    """
    global polling_state
    
    if polling_state["enabled"]:
        return jsonify({"success": False, "error": "Le polling est déjà actif"})
    
    data = request.get_json() or {}
    interval = data.get("interval_seconds", 300)
    
    if interval < 60:
        return jsonify({"success": False, "error": "L'intervalle minimum est de 60 secondes"})
    
    polling_state["enabled"] = True
    polling_state["interval_seconds"] = interval
    polling_state["last_error"] = None
    
    # Démarrer le thread de polling
    thread = threading.Thread(target=polling_worker, daemon=True)
    thread.start()
    polling_state["thread"] = thread
    
    logger.info(f"Polling démarré avec intervalle de {interval} secondes")
    
    return jsonify({
        "success": True,
        "message": f"Polling démarré (intervalle: {interval}s)"
    })


@app.route('/api/polling/stop', methods=['POST'])
def stop_polling():
    """
    Arrête le polling automatique des emails.
    """
    global polling_state
    
    if not polling_state["enabled"]:
        return jsonify({"success": False, "error": "Le polling n'est pas actif"})
    
    polling_state["enabled"] = False
    polling_state["next_check"] = None
    
    logger.info("Polling arrêté")
    
    return jsonify({
        "success": True,
        "message": "Polling arrêté"
    })


# ============================================================
# Routes CRM - Envoi des données vers l'API CRM (US005)
# ============================================================

@app.route('/api/crm/status', methods=['GET'])
def crm_status():
    """
    Vérifie le statut de l'API CRM.
    """
    try:
        status = get_crm_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({"available": False, "error": str(e)}), 500


@app.route('/api/crm/send', methods=['POST'])
def crm_send():
    """
    Envoie les données parsées vers le CRM (US005 + US008).
    
    Body JSON:
        - parsed_data: Données extraites par le parser (inclut pieces_jointes)
        - email_date: Date de l'email (optionnel)
        - email_id: ID de l'email pour nettoyage (optionnel)
    
    Returns:
        JSON avec le résultat de l'envoi (bien_id, demande_id, fichiers uploadés, etc.)
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('parsed_data'):
            return jsonify({
                "success": False,
                "error": "Les données parsées (parsed_data) sont requises"
            }), 400
        
        parsed_data = data.get('parsed_data')
        email_date = data.get('email_date')
        email_id = data.get('email_id')
        
        # Envoyer les données principales au CRM
        result = send_to_crm(parsed_data, email_date)
        
        if result.get("success"):
            demande_id = result.get("demande_id")
            pieces_jointes = parsed_data.get("pieces_jointes", [])
            
            # Upload des pièces jointes si demande créée (US008)
            if demande_id and pieces_jointes:
                logger.info(f"Upload de {len(pieces_jointes)} pièce(s) jointe(s) pour demande_id={demande_id}")
                upload_result = upload_all_files(pieces_jointes, demande_id)
                result["fichiers_uploades"] = upload_result.get("uploaded", [])
                result["fichiers_count"] = upload_result.get("count", 0)
                if upload_result.get("errors"):
                    result["fichiers_erreurs"] = upload_result["errors"]
                
                # Nettoyage des fichiers temporaires
                if email_id:
                    cleanup_email_attachments(email_id)
                    logger.info(f"Nettoyage fichiers temporaires pour email_id={email_id}")
            
            # Archivage déjà fait automatiquement après parsing (voir auto_parse_emails)
            
            return jsonify(result)
        elif result.get("ambiguous"):
            return jsonify(result), 300  # Multiple Choices
        else:
            status_code = 503 if result.get("queued") else 400
            return jsonify(result), status_code
            
    except Exception as e:
        logger.error(f"Erreur envoi CRM: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/emails/<email_id>/unarchive', methods=['POST'])
def unarchive_email_endpoint(email_id):
    try:
        message_id = None
        with parsed_demandes_lock:
            for d in parsed_demandes:
                if d.get("email_id") == email_id:
                    message_id = d.get("message_id")
                    break

        result = unarchive_email(email_id, message_id=message_id)

        if result.get("success"):
            with parsed_demandes_lock:
                for d in parsed_demandes:
                    if d.get("email_id") == email_id:
                        d["archived"] = False
                        d["archive_folder"] = None
                        break

        return jsonify(result)
    except Exception as e:
        logger.error(f"Erreur désarchivage email {email_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/crm/queue', methods=['GET'])
def crm_queue_list():
    """
    Liste les éléments en queue (erreurs temporaires).
    """
    try:
        queue = get_queue()
        return jsonify({
            "success": True,
            "queue": queue,
            "count": len(queue)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/crm/queue/<int:item_id>/retry', methods=['POST'])
def crm_queue_retry(item_id):
    """
    Retente l'envoi d'un élément de la queue.
    """
    try:
        result = retry_queue_item(item_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/crm/queue/clear', methods=['POST'])
def crm_queue_clear():
    """
    Vide la queue des erreurs.
    """
    try:
        result = clear_queue()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
