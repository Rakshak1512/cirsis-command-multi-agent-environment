import time
import secrets
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory OTP storage: email -> { "otp_hash": str, "expires_at": float, "attempts": int, "resend_after": float }
_otp_store: Dict[str, Dict[str, Any]] = {}

def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"pbkdf2${salt}${hashed}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    if hashed_password.startswith("pbkdf2$"):
        try:
            _, salt, h = hashed_password.split("$")
            check = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
            return secrets.compare_digest(check, h)
        except Exception:
            return False
    if hashed_password.startswith("sha256$"):
        try:
            _, salt, h = hashed_password.split("$")
            check = hashlib.sha256((plain_password + salt).encode()).hexdigest()
            return secrets.compare_digest(check, h)
        except Exception:
            return False
    if plain_password == hashed_password:
        return True
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_bearer = HTTPBearer(auto_error=False)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        secret = settings.JWT_SECRET or os.getenv("JWT_SECRET", "default_crisis_command_jwt_secret_dev")
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Optional[Dict[str, Any]]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    email = payload.get("email")
    if not email:
        return None
    from app.core.database import db
    return db.users.get(email.strip().lower())

def get_required_user(user: Optional[Dict[str, Any]] = Depends(get_current_user)) -> Dict[str, Any]:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated credentials required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def generate_otp(email: str) -> str:
    """Generates a secure 6-digit OTP and stores its SHA-256 hash with expiry (5 mins) and attempt counter."""
    clean_email = email.strip().lower()
    now = time.time()

    # Look up in memory first, then Firestore if available
    existing = _otp_store.get(clean_email)
    if not existing:
        try:
            from app.core.database import db
            if db._firestore_db:
                doc = db._firestore_db.collection("otp_verifications").document(clean_email).get()
                if doc.exists:
                    existing = doc.to_dict()
                    _otp_store[clean_email] = existing
        except Exception:
            pass

    if existing and now < existing.get("resend_after", 0):
        remaining = max(1, int(existing["resend_after"] - now))
        raise ValueError(f"Please wait {remaining} seconds before requesting a new OTP.")

    otp_digits = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = hashlib.sha256(otp_digits.encode()).hexdigest()

    entry = {
        "otp_hash": otp_hash,
        "expires_at": now + 300,  # 5 minutes
        "resend_after": now + 60,  # 1 minute cooldown
        "attempts": 0,
        "max_attempts": 5
    }
    _otp_store[clean_email] = entry

    try:
        from app.core.database import db
        if db._firestore_db:
            db._firestore_db.collection("otp_verifications").document(clean_email).set(entry)
    except Exception:
        pass

    return otp_digits

def verify_otp(email: str, entered_otp: str) -> bool:
    """Verifies a 6-digit OTP server-side. Enforces max attempts and expiration."""
    clean_email = email.strip().lower()
    entry = _otp_store.get(clean_email)

    if not entry:
        try:
            from app.core.database import db
            if db._firestore_db:
                doc = db._firestore_db.collection("otp_verifications").document(clean_email).get()
                if doc.exists:
                    entry = doc.to_dict()
                    _otp_store[clean_email] = entry
        except Exception:
            pass

    if not entry:
        return False

    now = time.time()
    if now > entry.get("expires_at", 0):
        _otp_store.pop(clean_email, None)
        try:
            from app.core.database import db
            if db._firestore_db:
                db._firestore_db.collection("otp_verifications").document(clean_email).delete()
        except Exception:
            pass
        return False

    if entry.get("attempts", 0) >= entry.get("max_attempts", 5):
        _otp_store.pop(clean_email, None)
        try:
            from app.core.database import db
            if db._firestore_db:
                db._firestore_db.collection("otp_verifications").document(clean_email).delete()
        except Exception:
            pass
        raise ValueError("Maximum OTP verification attempts exceeded. Please request a new OTP.")

    entry["attempts"] = entry.get("attempts", 0) + 1
    entered_hash = hashlib.sha256(entered_otp.strip().encode()).hexdigest()

    if entered_hash == entry["otp_hash"]:
        _otp_store.pop(clean_email, None)
        try:
            from app.core.database import db
            if db._firestore_db:
                db._firestore_db.collection("otp_verifications").document(clean_email).delete()
        except Exception:
            pass
        return True

    # Persist updated attempt count
    try:
        from app.core.database import db
        if db._firestore_db:
            db._firestore_db.collection("otp_verifications").document(clean_email).set(entry)
    except Exception:
        pass

    return False
