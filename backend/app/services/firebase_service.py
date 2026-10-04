"""
CRISIS COMMAND — Firebase Admin Integration Service
Initializes Firebase Admin SDK from environment variables without requiring a JSON service account file.
Provides robust support for Render deployment, Cloud Firestore persistence, and Firebase Auth sync.
"""

import os
import logging
from typing import Optional, Any, Dict

logger = logging.getLogger("crisis_command.firebase")

_firebase_app: Optional[Any] = None
_firestore_db: Optional[Any] = None

def get_firebase_credentials() -> Optional[dict]:
    # Support both os.getenv and settings
    project_id = os.getenv("FIREBASE_PROJECT_ID", "")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "")
    raw_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")

    if not project_id or not client_email or not raw_private_key:
        try:
            from app.core.config import settings
            project_id = project_id or settings.FIREBASE_PROJECT_ID or ""
            client_email = client_email or settings.FIREBASE_CLIENT_EMAIL or ""
            raw_private_key = raw_private_key or settings.FIREBASE_PRIVATE_KEY or ""
        except Exception:
            pass

    project_id = str(project_id).strip().strip("'\"")
    client_email = str(client_email).strip().strip("'\"")
    raw_private_key = str(raw_private_key).strip()

    if not project_id or not client_email or not raw_private_key:
        logger.info("Firebase environment variables not fully configured; operating in local database mode.")
        return None

    # Handle enclosing quotes and commas from Render / .env
    if (raw_private_key.startswith('"') and raw_private_key.endswith('"')) or \
       (raw_private_key.startswith("'") and raw_private_key.endswith("'")):
        raw_private_key = raw_private_key[1:-1]
    raw_private_key = raw_private_key.rstrip(',').strip()

    # Handle escaped newline characters safely
    private_key = raw_private_key.replace("\\n", "\n").strip()

    if not private_key.startswith("-----BEGIN") or not private_key.endswith("KEY-----"):
        logger.warning("FIREBASE_PRIVATE_KEY does not start with '-----BEGIN' or end with 'KEY-----'. Check key formatting.")

    return {
        "type": "service_account",
        "project_id": project_id,
        "private_key": private_key,
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }

def initialize_firebase():
    global _firebase_app, _firestore_db
    if _firebase_app is not None:
        return _firebase_app

    cred_dict = get_firebase_credentials()
    if not cred_dict:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            _firestore_db = firestore.client()
            logger.info(f"Firebase Admin SDK successfully initialized for project: {cred_dict['project_id']}")
        else:
            _firebase_app = firebase_admin.get_app()
            _firestore_db = firestore.client()
        return _firebase_app
    except ImportError:
        logger.warning("firebase-admin package not installed. Skipping Firebase Admin initialization.")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return None

def get_firestore_client():
    global _firestore_db
    if _firestore_db is None:
        initialize_firebase()
    return _firestore_db

def is_firestore_available() -> bool:
    return get_firestore_client() is not None

def sync_auth_user(email: str, password: Optional[str] = None, display_name: Optional[str] = None, uid: Optional[str] = None) -> Optional[str]:
    """
    Attempts to sync or create user in Firebase Authentication if Identity Platform is configured.
    Never raises an uncaught exception; logs warnings if Firebase Auth provider is not enabled.
    """
    app = initialize_firebase()
    if not app:
        return None
    try:
        from firebase_admin import auth
        try:
            existing = auth.get_user_by_email(email)
            return existing.uid
        except auth.UserNotFoundError:
            kwargs: Dict[str, Any] = {"email": email}
            if password:
                kwargs["password"] = password
            if display_name:
                kwargs["display_name"] = display_name
            if uid:
                kwargs["uid"] = uid
            user = auth.create_user(**kwargs)
            logger.info(f"Firebase Auth user created: {email} (uid: {user.uid})")
            return user.uid
    except Exception as e:
        logger.warning(f"Firebase Auth sync skipped for {email}: {e}")
        return None
