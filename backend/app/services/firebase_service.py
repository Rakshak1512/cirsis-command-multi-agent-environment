"""
CRISIS COMMAND — Firebase Admin Integration Service
Initializes Firebase Admin SDK from environment variables without requiring a JSON service account file.
"""

import os
import logging
from typing import Optional, Any

logger = logging.getLogger("crisis_command.firebase")

_firebase_app: Optional[Any] = None
_firestore_db: Optional[Any] = None

def get_firebase_credentials() -> Optional[dict]:
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    raw_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")

    if not project_id or not client_email or not raw_private_key:
        return None

    # Handle escaped newline characters safely
    private_key = raw_private_key.replace("\\n", "\n").strip()

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
        logger.info("Firebase environment variables not fully configured; operating in local database mode.")
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
