"""
US011 - Extraction de données depuis les URLs dans les emails.
Télécharge et extrait le texte des PDFs et pages HTML référencés.
"""

import re
import logging
import requests
from io import BytesIO
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger('url-extractor')

# Configuration
REQUEST_TIMEOUT = 30  # secondes
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_HTML_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_URLS_PER_EMAIL = 5
MAX_RETRIES = 2

# Pattern pour détecter les URLs
URL_PATTERN = r'https?://[^\s<>"\']+[^\s<>"\'.,;:!?\)]'

# Patterns à ignorer
IGNORE_PATTERNS = [
    r'mailto:',
    r'unsubscribe',
    r'desinscription',
    r'signature',
    r'logo',
    r'image',
    r'\.png',
    r'\.jpg',
    r'\.jpeg',
    r'\.gif',
    r'\.svg',
    r'\.ico',
    r'facebook\.com',
    r'linkedin\.com',
    r'twitter\.com',
    r'instagram\.com',
    r'youtube\.com',
    r'google\.com/maps',
    r'goo\.gl',
    r'bit\.ly',
    r'tracking',
    r'pixel',
    r'analytics',
    r'fonts\.googleapis',
    r'cdn\.',
]


def extract_urls(text: str) -> List[str]:
    """Extrait toutes les URLs d'un texte."""
    if not text:
        return []
    
    urls = re.findall(URL_PATTERN, text)
    return list(set(urls))  # Dédupliquer


def is_relevant_url(url: str) -> bool:
    """Vérifie si une URL est pertinente (pas un logo, réseau social, etc.)."""
    url_lower = url.lower()
    
    for pattern in IGNORE_PATTERNS:
        if re.search(pattern, url_lower):
            return False
    
    return True


def filter_urls(urls: List[str]) -> List[str]:
    """Filtre les URLs pour ne garder que les pertinentes."""
    relevant = [url for url in urls if is_relevant_url(url)]
    # Limiter le nombre d'URLs
    return relevant[:MAX_URLS_PER_EMAIL]


def download_content(url: str) -> Optional[requests.Response]:
    """Télécharge le contenu d'une URL avec retry."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; EmailParser/1.0)',
        'Accept': 'text/html,application/pdf,application/xhtml+xml,*/*'
    }
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(
                url, 
                timeout=REQUEST_TIMEOUT, 
                headers=headers,
                allow_redirects=True
            )
            response.raise_for_status()
            return response
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout URL (tentative {attempt + 1}/{MAX_RETRIES}): {url}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"Erreur URL (tentative {attempt + 1}/{MAX_RETRIES}): {url} - {e}")
    
    return None


def extract_pdf_text(content: bytes) -> str:
    """Extrait le texte d'un PDF depuis son contenu binaire."""
    try:
        import pdfplumber
        
        if len(content) > MAX_PDF_SIZE:
            logger.warning(f"PDF trop volumineux: {len(content)} bytes (max {MAX_PDF_SIZE})")
            return ""
        
        with pdfplumber.open(BytesIO(content)) as pdf:
            texts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    texts.append(text)
            return '\n'.join(texts)
    except Exception as e:
        logger.error(f"Erreur extraction PDF: {e}")
        return ""


def extract_html_text(content: str) -> str:
    """Extrait le texte d'une page HTML."""
    try:
        soup = BeautifulSoup(content, 'html.parser')
        
        # Supprimer les éléments non pertinents
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 
                         'aside', 'noscript', 'iframe', 'form']):
            tag.decompose()
        
        # Supprimer les éléments avec certaines classes
        for element in soup.find_all(class_=re.compile(r'(menu|sidebar|footer|header|nav|cookie|banner)')):
            element.decompose()
        
        text = soup.get_text(separator='\n', strip=True)
        
        # Nettoyer les lignes vides multiples
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    except Exception as e:
        logger.error(f"Erreur extraction HTML: {e}")
        return ""


def extract_with_playwright(url: str, timeout_ms: int = 30000) -> Dict[str, Any]:
    """
    Extrait le contenu d'une page web JavaScript avec Playwright (navigateur headless).
    Utilisé comme fallback quand l'extraction standard échoue.
    
    Returns:
        Dict avec 'html', 'text', 'pdf_links', 'success', 'error'
    """
    result = {
        'html': '',
        'text': '',
        'pdf_links': [],
        'success': False,
        'error': None
    }
    
    try:
        from playwright.sync_api import sync_playwright
        import os
        
        logger.info(f"Extraction Playwright: {url}")
        
        with sync_playwright() as p:
            # Lancer Chromium en mode headless
            browser = p.chromium.launch(
                headless=True,
                executable_path=os.environ.get('CHROMIUM_PATH', '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium')
            )
            
            try:
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                page = context.new_page()
                
                # Naviguer vers la page avec timeout
                page.goto(url, timeout=timeout_ms, wait_until='networkidle')
                
                # Attendre que le contenu soit chargé (rechercher des éléments typiques)
                page.wait_for_timeout(3000)  # Attendre 3s pour le rendu JS
                
                # Récupérer le HTML rendu
                result['html'] = page.content()
                
                # Extraire le texte visible
                result['text'] = page.evaluate('''() => {
                    return document.body.innerText || document.body.textContent || '';
                }''')
                
                # Chercher les liens PDF
                pdf_links = page.evaluate('''() => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    return links
                        .map(a => a.href)
                        .filter(href => href && (href.toLowerCase().includes('.pdf') || href.toLowerCase().includes('pdf')));
                }''')
                result['pdf_links'] = list(set(pdf_links))[:5]  # Max 5 PDFs
                
                # Chercher aussi les liens de téléchargement (sélecteurs CSS standards)
                try:
                    download_links = page.evaluate('''() => {
                        const selectors = '[download], [href*="download"], [href*="telecharger"]';
                        const elements = Array.from(document.querySelectorAll(selectors));
                        // Chercher aussi les liens contenant "PDF" ou "Télécharger" dans le texte
                        const allLinks = Array.from(document.querySelectorAll('a[href]'));
                        const textLinks = allLinks.filter(a => {
                            const text = (a.innerText || a.textContent || '').toLowerCase();
                            return text.includes('pdf') || text.includes('télécharger') || text.includes('telecharger');
                        });
                        return [...elements, ...textLinks].map(el => el.href || el.getAttribute('data-url') || '').filter(Boolean);
                    }''')
                    for link in download_links:
                        if link and link not in result['pdf_links']:
                            result['pdf_links'].append(link)
                except Exception as e:
                    logger.warning(f"Erreur recherche liens téléchargement: {e}")
                
                result['success'] = bool(result['text'] and len(result['text']) > 50)
                
                if result['success']:
                    logger.info(f"Playwright: {len(result['text'])} chars, {len(result['pdf_links'])} PDF links")
                
            finally:
                browser.close()
                
    except Exception as e:
        logger.error(f"Erreur Playwright: {e}")
        result['error'] = str(e)
    
    return result


def extract_pdf_links_from_html(html_content: str, base_url: str) -> List[str]:
    """
    Extrait les liens vers des fichiers PDF depuis une page HTML.
    
    Args:
        html_content: Le contenu HTML de la page
        base_url: L'URL de base pour résoudre les URLs relatives
        
    Returns:
        Liste des URLs de PDFs trouvés
    """
    pdf_links = []
    
    try:
        from urllib.parse import urljoin, urlparse
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Chercher tous les liens
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if not isinstance(href, str):
                continue
            
            # Vérifier si c'est un lien vers un PDF
            if href.lower().endswith('.pdf') or 'pdf' in href.lower():
                # Résoudre l'URL relative en absolue
                full_url = urljoin(base_url, href)
                
                # Vérifier que c'est une URL valide
                parsed = urlparse(full_url)
                if parsed.scheme in ('http', 'https'):
                    pdf_links.append(full_url)
        
        # Dédupliquer
        pdf_links = list(set(pdf_links))
        
        if pdf_links:
            logger.info(f"Liens PDF trouvés dans la page: {len(pdf_links)}")
        
    except Exception as e:
        logger.error(f"Erreur extraction liens PDF: {e}")
    
    return pdf_links[:3]  # Limiter à 3 PDFs par page


def extract_url_content(url: str, follow_pdf_links: bool = True) -> Dict[str, Any]:
    """
    Télécharge et extrait le contenu d'une URL.
    Si c'est une page HTML et follow_pdf_links=True, cherche et télécharge les PDFs liés.
    
    Returns:
        Dict avec 'text', 'type', 'url', 'success', 'linked_pdfs'
    """
    result = {
        'url': url,
        'type': None,
        'text': '',
        'success': False,
        'error': None,
        'linked_pdfs': []
    }
    
    logger.info(f"Extraction URL: {url}")
    
    response = download_content(url)
    if not response:
        result['error'] = 'Téléchargement échoué'
        return result
    
    content_type = response.headers.get('content-type', '').lower()
    content_length = len(response.content)
    
    logger.info(f"URL content-type: {content_type}, size: {content_length}")
    
    # Détecter le type de contenu
    if 'application/pdf' in content_type or url.lower().endswith('.pdf'):
        result['type'] = 'pdf'
        if content_length <= MAX_PDF_SIZE:
            result['text'] = extract_pdf_text(response.content)
            result['success'] = bool(result['text'])
        else:
            result['error'] = f'PDF trop volumineux ({content_length} bytes)'
    
    elif 'text/html' in content_type or 'application/xhtml' in content_type:
        result['type'] = 'html'
        if content_length <= MAX_HTML_SIZE:
            html_text = extract_html_text(response.text)
            texts = [html_text] if html_text else []
            pdf_links = []
            
            # Chercher les PDFs liés dans le HTML statique
            if follow_pdf_links:
                pdf_links = extract_pdf_links_from_html(response.text, url)
            
            # Si pas de texte extrait et pas de PDF trouvé, essayer Playwright
            # (probable site JavaScript/SPA)
            if not html_text and not pdf_links and follow_pdf_links:
                logger.info("HTML vide, tentative extraction Playwright...")
                pw_result = extract_with_playwright(url)
                
                if pw_result['success']:
                    html_text = pw_result['text']
                    texts = [html_text]
                    pdf_links = pw_result['pdf_links']
                    logger.info(f"Playwright réussi: {len(html_text)} chars, {len(pdf_links)} PDFs")
            
            # Télécharger les PDFs trouvés
            for pdf_url in pdf_links:
                logger.info(f"Téléchargement PDF lié: {pdf_url}")
                pdf_result = extract_url_content(pdf_url, follow_pdf_links=False)
                
                if pdf_result['success'] and pdf_result['text']:
                    texts.append(f"=== PDF: {pdf_url} ===\n{pdf_result['text']}")
                    result['linked_pdfs'].append({
                        'url': pdf_url,
                        'chars': len(pdf_result['text'])
                    })
            
            result['text'] = '\n\n'.join(texts)
            result['success'] = bool(result['text'])
        else:
            result['error'] = f'HTML trop volumineux ({content_length} bytes)'
    
    else:
        result['error'] = f'Type non supporté: {content_type}'
    
    if result['success']:
        pdf_count = len(result['linked_pdfs'])
        pdf_info = f" + {pdf_count} PDF(s) liés" if pdf_count > 0 else ""
        logger.info(f"URL extraite avec succès: {len(result['text'])} caractères{pdf_info}")
    else:
        logger.warning(f"Échec extraction URL: {result['error']}")
    
    return result


def extract_all_urls_content(email_body: str, email_html: str = "") -> Dict[str, Any]:
    """
    Extrait le contenu de toutes les URLs pertinentes d'un email.
    
    Returns:
        Dict avec 'urls_found', 'urls_processed', 'combined_text', 'sources'
    """
    result = {
        'urls_found': [],
        'urls_processed': [],
        'combined_text': '',
        'sources': []
    }
    
    # Extraire les URLs du corps texte et HTML
    all_text = f"{email_body}\n{email_html}"
    urls = extract_urls(all_text)
    result['urls_found'] = urls
    
    if not urls:
        return result
    
    # Filtrer les URLs pertinentes
    relevant_urls = filter_urls(urls)
    logger.info(f"URLs trouvées: {len(urls)}, pertinentes: {len(relevant_urls)}")
    
    texts = []
    for url in relevant_urls:
        url_result = extract_url_content(url)
        result['urls_processed'].append(url_result)
        
        if url_result['success'] and url_result['text']:
            texts.append(f"=== Contenu de {url} ===\n{url_result['text']}")
            result['sources'].append({
                'url': url,
                'type': url_result['type']
            })
            
            # Ajouter les PDFs liés comme sources séparées
            for linked_pdf in url_result.get('linked_pdfs', []):
                result['sources'].append({
                    'url': linked_pdf['url'],
                    'type': 'pdf',
                    'linked_from': url
                })
    
    result['combined_text'] = '\n\n'.join(texts)
    
    return result
