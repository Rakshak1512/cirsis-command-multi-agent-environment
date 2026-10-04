import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, List, Tuple, Any
from app.core.config import settings

logger = logging.getLogger("crisis_command.smtp")

# Local outbox tracker for development/testing inspection
_mock_email_outbox: List[Dict[str, str]] = []

def get_smtp_config() -> Dict[str, Any]:
    """Extracts and sanitizes SMTP configuration from environment or settings."""
    host = str(os.getenv("SMTP_HOST") or settings.SMTP_HOST or "smtp.gmail.com").strip().strip("'\"")
    raw_port = str(os.getenv("SMTP_PORT") or settings.SMTP_PORT or 587).strip().strip("'\"")
    try:
        port = int(raw_port)
    except ValueError:
        port = 587

    username = str(os.getenv("SMTP_USERNAME") or settings.SMTP_USERNAME or "").strip().strip("'\"")
    password = str(os.getenv("SMTP_PASSWORD") or settings.SMTP_PASSWORD or "").strip().strip("'\"")
    from_name = str(os.getenv("SMTP_FROM_NAME") or getattr(settings, "SMTP_FROM_NAME", None) or "Crisis Command").strip().strip("'\"")
    from_email = str(os.getenv("SMTP_FROM_EMAIL") or settings.SMTP_FROM_EMAIL or username or "").strip().strip("'\"")
    use_tls = str(os.getenv("SMTP_USE_TLS", "true")).lower() in ("true", "1", "yes")

    # Align sender authorization: when using Gmail SMTP, from_email must match authenticated username
    # or the domain authorized by the SMTP provider to avoid sender authorization rejection
    if username and "@gmail.com" in username.lower() and ("noreply@" in from_email or not from_email):
        from_email = username

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "from_name": from_name,
        "from_email": from_email,
        "use_tls": use_tls,
    }

import json
import urllib.request
import urllib.error

_last_delivery_error: Optional[str] = None

def get_last_delivery_error() -> Optional[str]:
    return _last_delivery_error

def send_via_resend(to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
    """Sends email via Resend HTTPS API (bypasses Render outbound SMTP port blocking)."""
    api_key = str(os.getenv("RESEND_API_KEY") or "").strip().strip("'\"")
    if not api_key:
        return False, "RESEND_API_KEY not configured"
    
    from_email = str(os.getenv("RESEND_FROM_EMAIL") or "Crisis Command <onboarding@resend.dev>").strip().strip("'\"")
    payload = json.dumps({
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "CrisisCommand/2026.1"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status in (200, 201):
                logger.info(f"Verification email dispatched via Resend HTTPS API to {to_email}")
                return True, "Delivered via Resend HTTPS API"
            return False, f"Resend API status {resp.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Resend API error {e.code}: {body}")
        return False, f"Resend API rejected request: {body}"
    except Exception as e:
        logger.error(f"Resend API connection error: {type(e).__name__}")
        return False, f"Resend connection failed: {type(e).__name__}"

def send_via_brevo(to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
    """Sends email via Brevo HTTPS API (bypasses Render outbound SMTP port blocking)."""
    api_key = str(os.getenv("BREVO_API_KEY") or "").strip().strip("'\"")
    if not api_key:
        return False, "BREVO_API_KEY not configured"
    
    from_email = str(os.getenv("BREVO_FROM_EMAIL") or os.getenv("SMTP_FROM_EMAIL") or "smart.event.system2026@gmail.com").strip().strip("'\"")
    from_name = str(os.getenv("SMTP_FROM_NAME") or "Crisis Command").strip().strip("'\"")
    
    payload = json.dumps({
        "sender": {"name": from_name, "email": from_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "CrisisCommand/2026.1"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status in (200, 201):
                logger.info(f"Verification email dispatched via Brevo HTTPS API to {to_email}")
                return True, "Delivered via Brevo HTTPS API"
            return False, f"Brevo API status {resp.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Brevo API error {e.code}: {body}")
        return False, f"Brevo API error: {body}"
    except Exception as e:
        logger.error(f"Brevo API connection error: {type(e).__name__}")
        return False, f"Brevo connection failed: {type(e).__name__}"

def verify_smtp_connection() -> Tuple[bool, str]:
    """Performs a lightweight probe to verify email provider connectivity."""
    # Check Resend or Brevo API first
    if os.getenv("RESEND_API_KEY"):
        return True, "Resend HTTPS Email API configured (Render-safe)"
    if os.getenv("BREVO_API_KEY"):
        return True, "Brevo HTTPS Email API configured (Render-safe)"
        
    cfg = get_smtp_config()
    if not cfg["username"] or not cfg["password"]:
        return False, "SMTP credentials unconfigured (SMTP_USERNAME or SMTP_PASSWORD missing in environment)"
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
            server.ehlo()
            if cfg["use_tls"]:
                server.starttls()
                server.ehlo()
            server.login(cfg["username"], cfg["password"])
        return True, "SMTP connection and credentials verified successfully"
    except smtplib.SMTPAuthenticationError as e:
        return False, f"SMTP authentication rejected (code {e.smtp_code})"
    except smtplib.SMTPException as e:
        return False, f"SMTP error: {type(e).__name__}"
    except OSError as e:
        return False, "Outbound SMTP blocked by host (Render Free Tier blocks ports 25, 465, and 587). Please configure RESEND_API_KEY."
    except Exception as e:
        return False, f"Connection failure: {type(e).__name__}"

def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Sends an email via HTTPS API (Resend/Brevo) or standard SMTP.
    Returns True on success, False on failure. Never leaks credentials.
    """
    global _last_delivery_error
    _last_delivery_error = None
    recipient_domain = to_email.split("@")[-1] if "@" in to_email else "unknown"

    # 1. Try Resend HTTPS API if configured (Render-safe)
    if os.getenv("RESEND_API_KEY"):
        ok, msg = send_via_resend(to_email, subject, html_content)
        if ok:
            return True
        logger.warning(f"Resend dispatch failed ({msg}), attempting fallback providers...")

    # 2. Try Brevo HTTPS API if configured (Render-safe)
    if os.getenv("BREVO_API_KEY"):
        ok, msg = send_via_brevo(to_email, subject, html_content)
        if ok:
            return True
        logger.warning(f"Brevo dispatch failed ({msg}), attempting fallback providers...")

    # 3. Standard SMTP fallback
    cfg = get_smtp_config()
    if not cfg["username"] or not cfg["password"]:
        err = "Email service unconfigured: SMTP credentials (or RESEND_API_KEY) are missing in environment."
        _last_delivery_error = err
        logger.error(f"Email delivery failed for {recipient_domain}: {err}")
        if settings.DEMO_MODE and settings.ENV == "development":
            _mock_email_outbox.append({"to": to_email, "subject": subject, "content": html_content})
            return True
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>" if cfg["from_name"] else cfg["from_email"]
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=12) as server:
                server.login(cfg["username"], cfg["password"])
                server.send_message(msg)
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=12) as server:
                server.ehlo()
                if cfg["use_tls"]:
                    server.starttls()
                    server.ehlo()
                server.login(cfg["username"], cfg["password"])
                server.send_message(msg)

        logger.info(f"Verification email successfully dispatched to domain: {recipient_domain}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        _last_delivery_error = f"SMTP authentication rejected by provider (code {e.smtp_code}). Please verify your email password/app password."
        logger.error(f"SMTP auth failure ({e.smtp_code}) for domain {recipient_domain}")
        return False
    except smtplib.SMTPRecipientsRefused:
        _last_delivery_error = "The recipient email address was refused by the mail server."
        logger.error(f"SMTP recipient refused by provider for domain: {recipient_domain}")
        return False
    except smtplib.SMTPException as e:
        _last_delivery_error = f"SMTP protocol error ({type(e).__name__})."
        logger.error(f"SMTP protocol error ({type(e).__name__}) for domain {recipient_domain}")
        return False
    except OSError as e:
        _last_delivery_error = (
            "Outbound SMTP connection blocked by Render Free Tier firewall (ports 25, 465, and 587 are blocked). "
            "To send emails on Render, add a free RESEND_API_KEY from resend.com in Render environment variables."
        )
        logger.error(f"Render SMTP port blocked (OSError) for {recipient_domain}: {_last_delivery_error}")
        return False
    except Exception as e:
        _last_delivery_error = f"Unexpected email connection error ({type(e).__name__})."
        logger.error(f"Unexpected connection error ({type(e).__name__}) for domain {recipient_domain}")
        return False

_latest_test_otps: Dict[str, str] = {}

def send_otp_email(to_email: str, otp: str, purpose: str = "Account Verification") -> bool:
    """Dispatches 6-digit OTP verification email. Never prints OTP to production logs."""
    _latest_test_otps[to_email.strip().lower()] = otp
    subject = f"Crisis Command - {purpose} Security Verification"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050811; color: #f8fafc; padding: 20px; }}
        .card {{ max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #38bdf8; border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(0, 240, 255, 0.15); }}
        .badge {{ display: inline-block; background: #ff334b; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; letter-spacing: 1px; }}
        .otp-box {{ background: #050811; border: 2px dashed #00f0ff; padding: 18px; text-align: center; border-radius: 8px; margin: 24px 0; }}
        .otp {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00f0ff; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">CRISIS COMMAND EMERGENCY NETWORK</span>
        <h2 style="color: #ffffff; margin-top: 16px;">{purpose}</h2>
        <p style="color: #94a3b8; line-height: 1.6;">
          You requested an authentication code for the <strong>Crisis Command Autonomous Emergency Response System</strong>.
        </p>
        <div class="otp-box">
          <div class="otp">{otp}</div>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">
          This 6-digit code will expire in <strong>5 minutes</strong>. For security, never share this code with anyone.
        </p>
        <div class="footer">
          GATEWAYS 2026 — Public Safety & Autonomous Emergency Response System
        </div>
      </div>
    </body>
    </html>
    """
    text = f"Your Crisis Command {purpose} code is: {otp}. It expires in 5 minutes. Never share this code."
    return send_smtp_email(to_email, subject, html, text)

def send_password_reset_email(to_email: str, otp: str) -> bool:
    return send_otp_email(to_email, otp, purpose="Password Reset")

def get_latest_otp_for_testing(email: str) -> Optional[str]:
    return _latest_test_otps.get(email.strip().lower())

def get_recent_outbox() -> List[Dict[str, str]]:
    return _mock_email_outbox[-10:]

