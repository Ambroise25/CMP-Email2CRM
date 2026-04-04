"""
Client IMAP pour Email2Extranet
Connexion et lecture des emails non lus
"""

import imaplib
import email
from email.header import decode_header
import os
import base64
import logging
from typing import Optional, Dict, Any, List, Tuple

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('imap_client')


def decode_mime_header(header_value: str) -> str:
    """Décode un header MIME encodé (ex: =?utf-8?B?...?=)"""
    if header_value is None:
        return ""
    
    decoded_parts = decode_header(header_value)
    result = []
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(encoding or 'utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)


def get_email_body(msg: email.message.Message) -> Tuple[str, str]:
    """
    Extrait le corps de l'email (texte brut et HTML).
    
    Returns:
        Tuple (body_text, body_html)
    """
    body_text = ""
    body_html = ""
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload and not body_text:
                    charset = part.get_content_charset() or 'utf-8'
                    body_text = payload.decode(charset, errors='replace')
            elif content_type == "text/html" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload and not body_html:
                    charset = part.get_content_charset() or 'utf-8'
                    body_html = payload.decode(charset, errors='replace')
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            content = payload.decode(charset, errors='replace')
            if msg.get_content_type() == "text/html":
                body_html = content
            else:
                body_text = content
    
    return body_text, body_html


def get_email_attachments(msg: email.message.Message) -> List[Dict[str, Any]]:
    """Extrait les pièces jointes de l'email (PDF et images)"""
    attachments = []
    
    if not msg.is_multipart():
        return attachments
    
    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", ""))
        content_type = part.get_content_type()
        
        # Vérifier si c'est une pièce jointe ou une image inline
        is_attachment = "attachment" in content_disposition
        is_inline_image = content_type.startswith("image/") and "inline" in content_disposition
        is_pdf = content_type == "application/pdf"
        is_image = content_type.startswith("image/")
        
        if is_attachment or is_inline_image or (is_pdf and part.get_payload()):
            filename = part.get_filename()
            if filename:
                filename = decode_mime_header(filename)
            else:
                # Générer un nom basé sur le type
                ext = content_type.split("/")[-1]
                filename = f"attachment.{ext}"
            
            payload = part.get_payload(decode=True)
            if payload:
                # Encoder en base64 pour le transport JSON
                content_base64 = base64.b64encode(payload).decode('utf-8')
                
                attachment_info = {
                    "filename": filename,
                    "content_type": content_type,
                    "size": len(payload),
                    "content_base64": content_base64
                }
                
                # Filtrer seulement PDF et images
                if is_pdf or is_image:
                    attachments.append(attachment_info)
    
    return attachments


def connect_imap() -> imaplib.IMAP4_SSL:
    """Établit une connexion IMAP sécurisée"""
    host = os.environ.get('IMAP_HOST')
    port = int(os.environ.get('IMAP_PORT', '993'))
    user = os.environ.get('IMAP_USER')
    password = os.environ.get('IMAP_PASSWORD')
    
    if not all([host, user, password]):
        logger.error("Variables IMAP manquantes - IMAP_HOST, IMAP_USER et IMAP_PASSWORD requises")
        raise ValueError("Variables IMAP_HOST, IMAP_USER et IMAP_PASSWORD requises")
    
    logger.info(f"Connexion IMAP à {host}:{port} pour {user}")
    mail = imaplib.IMAP4_SSL(host, port)
    mail.login(user, password)
    logger.info("Connexion IMAP établie avec succès")
    return mail


def get_imap_folder() -> str:
    """Retourne le dossier IMAP à utiliser (défaut: INBOX)"""
    return os.environ.get('IMAP_FOLDER', 'INBOX')


def fetch_one_unread_email() -> Optional[Dict[str, Any]]:
    """
    Récupère UN email non lu et retourne son contenu brut.
    
    Returns:
        Dict avec les clés: from, to, cc, subject, date, body_text, body_html, attachments
        None si aucun email non lu
    """
    mail = None
    folder = get_imap_folder()
    try:
        mail = connect_imap()
        mail.select(folder)
        logger.info(f"Recherche d'emails non lus dans {folder}")
        
        status, messages = mail.uid('search', None, 'UNSEEN')
        
        if status != 'OK':
            logger.warning(f"Échec de la recherche d'emails: status={status}")
            return None
        
        email_ids = messages[0].split()
        
        if not email_ids:
            logger.info("Aucun email non lu trouvé")
            return None
        
        logger.info(f"{len(email_ids)} email(s) non lu(s) trouvé(s)")
        
        email_id = email_ids[0]
        
        status, msg_data = mail.uid('fetch', email_id, '(BODY.PEEK[])')
        
        if status != 'OK':
            logger.error(f"Échec de la récupération de l'email {email_id}")
            return None
        
        mail.uid('store', email_id, '+FLAGS', '\\Seen')
        
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)
        
        attachments = get_email_attachments(msg)
        body_text, body_html = get_email_body(msg)
        
        # Extraire les destinataires CC
        cc_raw = msg.get('Cc', '')
        cc_list = [decode_mime_header(addr.strip()) for addr in cc_raw.split(',') if addr.strip()] if cc_raw else []
        
        # Extraire les destinataires To comme liste
        to_raw = msg.get('To', '')
        to_list = [decode_mime_header(addr.strip()) for addr in to_raw.split(',') if addr.strip()] if to_raw else []
        
        result = {
            "email_id": email_id.decode('utf-8'),
            "from": decode_mime_header(msg.get('From', '')),
            "to": to_list,
            "cc": cc_list,
            "subject": decode_mime_header(msg.get('Subject', '')),
            "date": msg.get('Date', ''),
            "body_text": body_text,
            "body_html": body_html,
            "body": body_text or body_html,  # Compatibilité avec l'ancien code
            "message_id": msg.get('Message-ID', ''),
            "attachments": attachments
        }
        
        logger.info(f"Email récupéré: {result['subject'][:50]}...")
        return result
        
    except Exception as e:
        logger.error(f"Erreur IMAP: {str(e)}")
        raise Exception(f"Erreur IMAP: {str(e)}")
    
    finally:
        if mail:
            try:
                mail.logout()
                logger.debug("Déconnexion IMAP")
            except:
                pass


def test_connection() -> Dict[str, Any]:
    """
    Teste la connexion IMAP et retourne des informations de base.
    
    Returns:
        Dict avec: connected, mailbox, total_emails, unread_count
    """
    mail = None
    folder = get_imap_folder()
    try:
        logger.info("Test de connexion IMAP...")
        mail = connect_imap()
        status, data = mail.select(folder)
        
        if status != 'OK':
            logger.error(f"Impossible d'ouvrir le dossier {folder}")
            return {"connected": False, "error": f"Impossible d'ouvrir {folder}"}
        
        total = int(data[0])
        
        # Compter les non lus
        status, messages = mail.search(None, 'UNSEEN')
        unread_count = len(messages[0].split()) if status == 'OK' and messages[0] else 0
        
        logger.info(f"Connexion OK: {total} emails, {unread_count} non lus dans {folder}")
        
        return {
            "connected": True,
            "mailbox": folder,
            "total_emails": total,
            "unread_count": unread_count,
            "user": os.environ.get('IMAP_USER', ''),
            "host": os.environ.get('IMAP_HOST', ''),
            "port": int(os.environ.get('IMAP_PORT', '993'))
        }
        
    except Exception as e:
        logger.error(f"Échec de la connexion IMAP: {str(e)}")
        return {"connected": False, "error": str(e)}
    
    finally:
        if mail:
            try:
                mail.logout()
            except:
                pass


def fetch_all_unread_emails(limit: int = 20) -> list:
    """
    Récupère TOUS les emails non lus (limité à 'limit').
    
    Returns:
        Liste de dicts avec: from, to, cc, subject, date, body_text, body_html, attachments
    """
    mail = None
    folder = get_imap_folder()
    try:
        mail = connect_imap()
        mail.select(folder)
        logger.info(f"Récupération de tous les emails non lus dans {folder} (limite: {limit})")
        
        status, messages = mail.uid('search', None, 'UNSEEN')
        
        if status != 'OK':
            logger.warning(f"Échec de la recherche: status={status}")
            return []
        
        email_ids = messages[0].split()
        
        if not email_ids:
            logger.info("Aucun email non lu")
            return []
        
        total_found = len(email_ids)
        email_ids = email_ids[:limit]
        logger.info(f"Récupération de {len(email_ids)}/{total_found} emails")
        
        emails = []
        for email_id in email_ids:
            status, msg_data = mail.uid('fetch', email_id, '(BODY.PEEK[])')
            
            if status != 'OK':
                logger.warning(f"Échec récupération email {email_id}")
                continue
            
            mail.uid('store', email_id, '+FLAGS', '\\Seen')
            logger.debug(f"Email {email_id} marqué comme lu")
            
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            attachments = get_email_attachments(msg)
            body_text, body_html = get_email_body(msg)
            
            # Extraire les destinataires CC
            cc_raw = msg.get('Cc', '')
            cc_list = [decode_mime_header(addr.strip()) for addr in cc_raw.split(',') if addr.strip()] if cc_raw else []
            
            # Extraire les destinataires To comme liste
            to_raw = msg.get('To', '')
            to_list = [decode_mime_header(addr.strip()) for addr in to_raw.split(',') if addr.strip()] if to_raw else []
            
            emails.append({
                "email_id": email_id.decode('utf-8'),
                "from": decode_mime_header(msg.get('From', '')),
                "to": to_list,
                "cc": cc_list,
                "subject": decode_mime_header(msg.get('Subject', '')),
                "date": msg.get('Date', ''),
                "body_text": body_text,
                "body_html": body_html,
                "body": body_text or body_html,  # Compatibilité
                "message_id": msg.get('Message-ID', ''),
                "attachments": attachments
            })
        
        logger.info(f"{len(emails)} email(s) récupéré(s)")
        return emails
        
    except Exception as e:
        logger.error(f"Erreur IMAP: {str(e)}")
        raise Exception(f"Erreur IMAP: {str(e)}")
    
    finally:
        if mail:
            try:
                mail.logout()
            except:
                pass


def get_archive_folder() -> str:
    """Retourne le dossier d'archivage (défaut: Email traite)"""
    return os.environ.get('IMAP_FOLDER_ARCHIVE', 'Email traite')


def get_errors_folder() -> str:
    """Retourne le dossier d'erreurs (défaut: Erreurs)"""
    return os.environ.get('IMAP_FOLDER_ERRORS', 'Erreurs')


def quote_folder(name: str) -> str:
    """Ajoute des guillemets IMAP autour d'un nom de dossier contenant des espaces."""
    if ' ' in name and not name.startswith('"'):
        return f'"{name}"'
    return name


def ensure_folder_exists(mail: imaplib.IMAP4_SSL, folder_name: str) -> bool:
    """
    Vérifie si un dossier IMAP existe, le crée si nécessaire.
    
    Args:
        mail: Connexion IMAP active
        folder_name: Nom du dossier à vérifier/créer
    
    Returns:
        True si le dossier existe ou a été créé, False sinon
    """
    quoted = quote_folder(folder_name)
    try:
        status, _ = mail.select(quoted)
        if status == 'OK':
            logger.debug(f"Dossier '{folder_name}' existe déjà")
            return True
    except:
        pass
    
    try:
        status, _ = mail.create(quoted)
        if status == 'OK':
            logger.info(f"Dossier '{folder_name}' créé avec succès")
            return True
        else:
            logger.error(f"Échec de la création du dossier '{folder_name}'")
            return False
    except Exception as e:
        logger.error(f"Erreur lors de la création du dossier '{folder_name}': {str(e)}")
        return False


def move_email_to_folder(email_id: str, target_folder: str) -> Dict[str, Any]:
    """
    Déplace un email vers un dossier cible.
    
    Args:
        email_id: ID de l'email à déplacer
        target_folder: Dossier de destination
    
    Returns:
        Dict avec success, message, folder
    """
    mail = None
    source_folder = get_imap_folder()
    
    try:
        mail = connect_imap()
        
        if not ensure_folder_exists(mail, target_folder):
            return {
                "success": False,
                "error": f"Impossible de créer le dossier '{target_folder}'"
            }
        
        quoted_source = quote_folder(source_folder)
        quoted_target = quote_folder(target_folder)
        mail.select(quoted_source)
        
        email_id_bytes = email_id.encode('utf-8') if isinstance(email_id, str) else email_id
        
        status, _ = mail.uid('copy', email_id_bytes, quoted_target)
        if status != 'OK':
            logger.error(f"Échec de la copie de l'email UID {email_id} vers {target_folder}")
            return {
                "success": False,
                "error": f"Échec de la copie vers '{target_folder}'"
            }
        
        mail.uid('store', email_id_bytes, '+FLAGS', '\\Deleted')
        mail.expunge()
        
        logger.info(f"Email {email_id} déplacé vers '{target_folder}'")
        return {
            "success": True,
            "message": f"Email archivé dans '{target_folder}'",
            "folder": target_folder
        }
        
    except Exception as e:
        logger.error(f"Erreur lors du déplacement de l'email {email_id}: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
    
    finally:
        if mail:
            try:
                mail.logout()
            except:
                pass


def archive_email(email_id: str) -> Dict[str, Any]:
    """
    Archive un email traité avec succès vers le dossier 'Email traite'.
    
    Args:
        email_id: ID de l'email à archiver
    
    Returns:
        Dict avec success, message, folder
    """
    archive_folder = get_archive_folder()
    logger.info(f"Archivage de l'email {email_id} vers '{archive_folder}'")
    return move_email_to_folder(email_id, archive_folder)


def unarchive_email(email_id: str, message_id: str = None) -> Dict[str, Any]:
    archive_folder = get_archive_folder()
    inbox_folder = get_imap_folder()
    mail = None

    try:
        mail = connect_imap()

        quoted_folder = f'"{archive_folder}"' if ' ' in archive_folder else archive_folder
        status, _ = mail.select(quoted_folder)
        if status != 'OK':
            return {"success": False, "error": f"Impossible de sélectionner le dossier '{archive_folder}'"}

        found_uid = None

        if message_id:
            clean_mid = message_id.strip()
            if not clean_mid.startswith('<'):
                clean_mid = f'<{clean_mid}>'
            status, data = mail.uid('search', None, f'HEADER Message-ID "{clean_mid}"')
            if status == 'OK' and data[0]:
                uids = data[0].split()
                if uids:
                    found_uid = uids[0]
                    logger.info(f"Email trouvé par Message-ID dans archive: UID {found_uid}")

        if not found_uid:
            email_id_bytes = email_id.encode('utf-8') if isinstance(email_id, str) else email_id
            status, data = mail.uid('search', None, 'ALL')
            if status == 'OK' and data[0]:
                all_uids = data[0].split()
                if email_id_bytes in all_uids:
                    found_uid = email_id_bytes

        if not found_uid:
            return {"success": False, "error": f"Email non trouvé dans '{archive_folder}'"}

        quoted_inbox = f'"{inbox_folder}"' if ' ' in inbox_folder else inbox_folder
        status, _ = mail.uid('copy', found_uid, quoted_inbox)
        if status != 'OK':
            return {"success": False, "error": f"Échec de la copie vers '{inbox_folder}'"}

        mail.uid('store', found_uid, '+FLAGS', '\\Deleted')
        mail.expunge()

        logger.info(f"Email désarchivé (UID {found_uid.decode() if isinstance(found_uid, bytes) else found_uid}): '{archive_folder}' → '{inbox_folder}'")
        return {
            "success": True,
            "message": f"Email remis dans '{inbox_folder}'",
            "folder": inbox_folder
        }

    except Exception as e:
        logger.error(f"Erreur désarchivage email {email_id}: {e}")
        return {"success": False, "error": str(e)}

    finally:
        if mail:
            try:
                mail.logout()
            except:
                pass


def move_email_to_errors(email_id: str) -> Dict[str, Any]:
    """
    Déplace un email en erreur vers le dossier 'Erreurs'.
    
    Args:
        email_id: ID de l'email en erreur
    
    Returns:
        Dict avec success, message, folder
    """
    errors_folder = get_errors_folder()
    logger.info(f"Déplacement de l'email {email_id} vers '{errors_folder}' (erreur)")
    return move_email_to_folder(email_id, errors_folder)


if __name__ == "__main__":
    # Test direct
    print("Test de connexion IMAP...")
    result = test_connection()
    print(f"Résultat: {result}")
    
    if result.get("connected"):
        print("\nRécupération des emails non lus...")
        emails = fetch_all_unread_emails()
        print(f"Nombre d'emails non lus: {len(emails)}")
        for em in emails:
            print(f"  - {em['subject'][:50]}...")
