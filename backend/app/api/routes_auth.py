import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, status
from app.models.schemas import (
    UserRegisterRequest, OTPVerifyRequest, UserLoginRequest,
    ForgotPasswordRequest, ResetPasswordRequest, TokenResponse, UserResponse, UserRole,
    Resource, ResourceType, ResourceStatus
)
from app.core.config import settings
from app.core.database import db
from app.core.security import (
    get_password_hash, verify_password, create_access_token,
    decode_access_token, generate_otp, verify_otp
)
from app.services.smtp_service import send_otp_email, send_password_reset_email
from app.services.firebase_service import sync_auth_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory fast cache for pending registrations
_pending_registrations = {}

@router.post("/register")
def register(req: UserRegisterRequest):
    email = req.email.strip().lower()
    if db.get_user(email):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Restrict internal role creation via public registration
    if req.role in [UserRole.COMMANDER, UserRole.DISPATCHER]:
        raise HTTPException(
            status_code=400,
            detail="Commander and Dispatcher accounts are internal and must be provisioned by an administrator."
        )

    # Protect Admin registration
    if req.role == UserRole.ADMIN:
        valid_admin_codes = {"CRISIS-ADMIN-2026", "ADMIN-2026", "DEMO-ADMIN"}
        code = (req.admin_code or "").strip().upper()
        if code not in valid_admin_codes:
            raise HTTPException(
                status_code=403,
                detail="Valid administrative authorization code required for Admin registration."
            )

    try:
        otp = generate_otp(email)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    sent = send_otp_email(email, otp, purpose=f"Account Verification ({req.role.value})")
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Failed to dispatch verification email. Please verify that your email address is correct and that the email service is available."
        )

    # Construct pending registration record (with bcrypt hashed password — NEVER plaintext!)
    pending_record = {
        "id": f"usr_{str(uuid.uuid4())[:8]}",
        "email": email,
        "full_name": req.full_name,
        "role": req.role.value,
        "password_hash": get_password_hash(req.password),
        "status": "PENDING_VERIFICATION",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "station_name": req.station_name,
            "station_id": req.station_id,
            "team_leader_name": req.team_leader_name,
            "hospital_name": req.hospital_name,
            "hospital_id": req.hospital_id,
            "contact": req.contact,
            "address": req.location_address,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "emergency_capacity": req.emergency_capacity,
            "available_beds": req.available_beds,
            "icu_beds": req.icu_beds,
            "ambulance_capacity": req.ambulance_capacity,
            "equipment": req.equipment,
            "specializations": req.specializations,
            "organization": req.organization,
        }
    }

    _pending_registrations[email] = pending_record
    db.save_pending_registration(email, pending_record)

    # Note: OTP is NEVER returned in response data for security
    response_data = {
        "status": "success",
        "message": f"Verification 6-digit OTP dispatched to {email}. Please verify to activate your {req.role.value} account.",
        "email": email,
        "role": req.role.value
    }
    return response_data

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_endpoint(req: OTPVerifyRequest):
    email = req.email.strip().lower()
    try:
        valid = verify_otp(email, req.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user_data = _pending_registrations.pop(email, None) or db.pop_pending_registration(email)
    if not user_data:
        # Check if user already exists (e.g. forgot password flow or re-verification)
        user_data = db.get_user(email)
        if not user_data:
            raise HTTPException(status_code=404, detail="No registration found for this email.")
    else:
        user_data["is_verified"] = True
        user_data["status"] = "ACTIVE"
        db.save_user(user_data)

        # Optional Firebase Auth non-blocking synchronization
        try:
            sync_auth_user(
                email=email,
                display_name=user_data.get("full_name"),
                uid=user_data.get("id")
            )
        except Exception:
            pass

        # Dynamically provision emergency asset in Firestore for Fire Team or Hospital accounts
        meta = user_data.get("metadata") or {}
        now_str = datetime.utcnow().isoformat() + "Z"
        if user_data["role"] == "FIRE_TEAM":
            res_id = f"RES-FIRE-{uuid.uuid4().hex[:4].upper()}"
            team_name = meta.get("station_name") or user_data["full_name"]
            meta["station_id"] = res_id
            meta["station_name"] = team_name
            user_data["metadata"] = meta
            db.save_user(user_data)

            res_obj = Resource(
                id=res_id,
                name=team_name,
                type=ResourceType.FIRE_TEAM,
                status=ResourceStatus.AVAILABLE,
                latitude=float(meta.get("latitude") or 12.9720),
                longitude=float(meta.get("longitude") or 77.5950),
                address=meta.get("address") or "Metro Station Depot",
                contact=meta.get("contact") or email,
                capacity=int(meta.get("emergency_capacity") or 4),
                available_units=int(meta.get("emergency_capacity") or 4),
                equipment=meta.get("equipment") or ["Heavy Engine", "Hydraulic Extricator", "Thermal Imager"],
                specialization=["structural", "rescue"],
                updated_at=now_str
            )
            db.save_resource(res_obj)

        elif user_data["role"] == "HOSPITAL":
            res_id = f"RES-HOSP-{uuid.uuid4().hex[:4].upper()}"
            hosp_name = meta.get("hospital_name") or user_data["full_name"]
            meta["hospital_id"] = res_id
            meta["hospital_name"] = hosp_name
            user_data["metadata"] = meta
            db.save_user(user_data)

            res_obj = Resource(
                id=res_id,
                name=hosp_name,
                type=ResourceType.HOSPITAL,
                status=ResourceStatus.AVAILABLE,
                latitude=float(meta.get("latitude") or 12.9650),
                longitude=float(meta.get("longitude") or 77.6000),
                address=meta.get("address") or "Central Medical Center",
                contact=meta.get("contact") or email,
                capacity=int(meta.get("emergency_capacity") or 25),
                available_units=int(meta.get("available_beds") or 14),
                equipment=meta.get("equipment") or ["Trauma Bay", "ICU Suite", "Emergency Burn Unit"],
                specialization=meta.get("specializations") or ["Level-1 Trauma", "Burn Unit"],
                updated_at=now_str
            )
            db.save_resource(res_obj)

    # Generate JWT
    token = create_access_token({
        "sub": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "name": user_data["full_name"]
    })

    user_resp = UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data["full_name"],
        role=UserRole(user_data["role"]),
        is_verified=True,
        created_at=user_data["created_at"],
        metadata=user_data.get("metadata")
    )

    return TokenResponse(access_token=token, user=user_resp)

@router.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest):
    email = req.email.strip().lower()
    user_data = db.get_user(email)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(req.password, user_data.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user_data.get("is_verified") is False:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")

    # Server-Side Role Verification (Section 8, 9, 10 Rule)
    requested_role = req.selected_role or req.role
    if requested_role:
        def normalize_role(r_str: str) -> str:
            return r_str.strip().lower().replace("-", "_").replace(" ", "_")

        norm_requested = normalize_role(requested_role)
        norm_actual = normalize_role(user_data["role"])

        # Allow ADMIN portal access for COMMANDER / ADMIN roles
        admin_family = {"admin", "commander"}
        is_match = (norm_requested == norm_actual) or (norm_requested == "admin" and norm_actual in admin_family)

        if not is_match:
            role_display_names = {
                "citizen": "Citizen",
                "fire_team": "Fire Team",
                "hospital": "Hospital",
                "admin": "Admin",
                "commander": "Commander",
                "dispatcher": "Dispatcher"
            }
            actual_friendly = role_display_names.get(norm_actual, norm_actual.replace("_", " ").title())
            raise HTTPException(
                status_code=403,
                detail=f"Role mismatch. This account is registered as {actual_friendly}. Please select the correct account type."
            )

    token = create_access_token({
        "sub": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "name": user_data["full_name"]
    })

    user_resp = UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data["full_name"],
        role=UserRole(user_data["role"]),
        is_verified=user_data.get("is_verified", True),
        created_at=user_data["created_at"],
        metadata=user_data.get("metadata")
    )

    return TokenResponse(access_token=token, user=user_resp)

@router.post("/seed")
def trigger_seed(
    x_admin_seed_key: Optional[str] = Header(None, alias="X-Admin-Seed-Key"),
    force: bool = False
):
    """
    Protected administrative endpoint to seed test accounts into production Firestore.
    Requires header: X-Admin-Seed-Key matching configured administrative secret.
    """
    expected_secret = os.getenv("ADMIN_SEED_SECRET", getattr(settings, "ADMIN_SEED_SECRET", "CRISIS-COMMAND-ROOT-SEED-2026"))
    if not x_admin_seed_key or x_admin_seed_key.strip() != expected_secret.strip():
        raise HTTPException(
            status_code=403,
            detail="Unauthorized administrative action. Valid X-Admin-Seed-Key required."
        )

    from app.services.seed_service import seed_test_accounts
    summary = seed_test_accounts(force_update=force)
    return summary

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    if not db.get_user(email):
        # Avoid user enumeration while returning clean feedback
        return {"status": "success", "message": "If this email is registered, a password reset code has been sent."}

    try:
        otp = generate_otp(email)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    sent = send_password_reset_email(email, otp)
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Failed to dispatch password reset email. Please verify SMTP service or try again later."
        )

    return {"status": "success", "message": f"Password reset OTP sent to {email}."}

@router.get("/diagnostics")
def auth_diagnostics(x_admin_seed_key: Optional[str] = Header(None, alias="X-Admin-Seed-Key")):
    """Protected diagnostic endpoint to verify live Firestore and SMTP provider connectivity."""
    expected_secret = os.getenv("ADMIN_SEED_SECRET", getattr(settings, "ADMIN_SEED_SECRET", "CRISIS-COMMAND-ROOT-SEED-2026"))
    if not x_admin_seed_key or x_admin_seed_key.strip() != expected_secret.strip():
        raise HTTPException(status_code=403, detail="Unauthorized administrative action.")

    from app.services.smtp_service import verify_smtp_connection
    from app.services.firebase_service import is_firestore_available, get_firebase_credentials

    smtp_ok, smtp_msg = verify_smtp_connection()
    fs_ok = is_firestore_available()
    creds = get_firebase_credentials()

    return {
        "status": "healthy" if (smtp_ok and fs_ok) else "degraded",
        "firestore": {
            "connected": fs_ok,
            "project_id": creds.get("project_id") if creds else None,
            "users_in_cache": len(db.users)
        },
        "smtp": {
            "connected": smtp_ok,
            "detail": smtp_msg
        }
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    try:
        valid = verify_otp(email, req.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired reset OTP.")

    user_data = db.get_user(email)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data["password_hash"] = get_password_hash(req.new_password)
    db.save_user(user_data)
    return {"status": "success", "message": "Password reset successfully. You may now log in."}

@router.get("/users")
def list_users():
    """Lists registered users from persistent database."""
    db.sync_from_firestore()
    users_list = []
    for email, u in db.users.items():
        users_list.append({
            "id": u.get("id"),
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "role": u.get("role"),
            "is_verified": u.get("is_verified", True),
            "status": u.get("status", "ACTIVE"),
            "created_at": u.get("created_at"),
            "metadata": u.get("metadata", {})
        })
    return {"users": users_list, "total": len(users_list)}

@router.patch("/users/{email}/status")
def update_user_status(email: str, status_data: dict):
    """Updates user status or verification state in Firestore."""
    target_email = email.strip().lower()
    user = db.get_user(target_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if "status" in status_data:
        user["status"] = status_data["status"]
    if "is_verified" in status_data:
        user["is_verified"] = bool(status_data["is_verified"])
    db.save_user(user)
    
    return {
        "status": "success",
        "message": f"Updated status for {target_email}",
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "status": user.get("status", "ACTIVE"),
            "is_verified": user.get("is_verified", True)
        }
    }
