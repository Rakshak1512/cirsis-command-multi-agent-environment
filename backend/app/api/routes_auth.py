import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
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

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pending registrations awaiting OTP verification
_pending_registrations = {}

@router.post("/register")
def register(req: UserRegisterRequest):
    email = req.email.strip().lower()
    if email in db.users:
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
        send_otp_email(email, otp, purpose=f"Account Verification ({req.role.value})")
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    # Temporarily store pending registration details
    _pending_registrations[email] = {
        "id": f"usr_{str(uuid.uuid4())[:8]}",
        "email": email,
        "full_name": req.full_name,
        "role": req.role.value,
        "password_hash": get_password_hash(req.password),
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

    response_data = {
        "status": "success",
        "message": f"Verification 6-digit OTP dispatched to {email}. Please verify to activate your {req.role.value} account.",
        "email": email,
        "role": req.role.value
    }
    if settings.DEMO_MODE:
        response_data["otp"] = otp
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

    user_data = _pending_registrations.pop(email, None)
    if not user_data:
        # Check if user already exists (e.g. forgot password flow or re-verification)
        user_data = db.users.get(email)
        if not user_data:
            raise HTTPException(status_code=404, detail="No registration found for this email.")
    else:
        user_data["is_verified"] = True
        db.users[email] = user_data

        # Dynamically provision emergency asset for Fire Team or Hospital accounts
        meta = user_data.get("metadata") or {}
        now_str = datetime.utcnow().isoformat() + "Z"
        if user_data["role"] == "FIRE_TEAM":
            res_id = f"RES-FIRE-{uuid.uuid4().hex[:4].upper()}"
            team_name = meta.get("station_name") or user_data["full_name"]
            meta["station_id"] = res_id
            meta["station_name"] = team_name
            user_data["metadata"] = meta
            db.resources[res_id] = Resource(
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
        elif user_data["role"] == "HOSPITAL":
            res_id = f"RES-HOSP-{uuid.uuid4().hex[:4].upper()}"
            hosp_name = meta.get("hospital_name") or user_data["full_name"]
            meta["hospital_id"] = res_id
            meta["hospital_name"] = hosp_name
            user_data["metadata"] = meta
            db.resources[res_id] = Resource(
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
    user_data = db.users.get(email)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(req.password, user_data["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user_data.get("is_verified") is False:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")

    # Server-Side Role Verification (Section 8, 9, 10 Rule)
    requested_role = req.selected_role or req.role
    if requested_role:
        def normalize_role(r_str: str) -> str:
            return r_str.strip().lower().replace("-", "_").replace(" ", "_")

        role_display_names = {
            "citizen": "Citizen",
            "fire_team": "Fire Team",
            "hospital": "Hospital",
            "admin": "Admin",
            "commander": "Commander",
            "dispatcher": "Dispatcher"
        }

        norm_requested = normalize_role(requested_role)
        norm_actual = normalize_role(user_data["role"])

        if norm_requested != norm_actual:
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

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    if email not in db.users:
        # Avoid user enumeration while returning clean feedback
        return {"status": "success", "message": "If this email is registered, a password reset code has been sent."}

    try:
        otp = generate_otp(email)
        send_password_reset_email(email, otp)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    return {"status": "success", "message": f"Password reset OTP sent to {email}."}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    try:
        valid = verify_otp(email, req.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired reset OTP.")

    user_data = db.users.get(email)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data["password_hash"] = get_password_hash(req.new_password)
    return {"status": "success", "message": "Password reset successfully. You may now log in."}

@router.get("/users")
def list_users():
    """Lists registered users for Admin Directorate overview and management."""
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
    """Updates user status or verification state."""
    target_email = email.strip().lower()
    if target_email not in db.users:
        raise HTTPException(status_code=404, detail="User not found.")
    
    user = db.users[target_email]
    if "status" in status_data:
        user["status"] = status_data["status"]
    if "is_verified" in status_data:
        user["is_verified"] = bool(status_data["is_verified"])
    
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
