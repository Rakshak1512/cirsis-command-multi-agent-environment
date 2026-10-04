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

def verify_smtp_connection() -> Tuple[bool, str]:
    """Performs a lightweight probe to verify SMTP provider connectivity and credentials."""
    cfg = get_smtp_config()
    if not cfg["username"] or not cfg["password"]:
        return False, "SMTP credentials unconfigured (SMTP_USERNAME or SMTP_PASSWORD missing)"
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
    except Exception as e:
        return False, f"Connection failure: {type(e).__name__}"

def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Sends an email via SMTP.
    Returns True if successfully accepted by the SMTP provider.
    Returns False on delivery failures or when credentials are missing.
    Never logs credentials, passwords, or OTP secrets.
    """
    cfg = get_smtp_config()
    recipient_domain = to_email.split("@")[-1] if "@" in to_email else "unknown"

    if not cfg["username"] or not cfg["password"]:
        logger.error(f"SMTP delivery failed for {recipient_domain}: SMTP_USERNAME or SMTP_PASSWORD is not configured.")
        # If in local demo mode with explicit offline flag, record in mock outbox
        if settings.DEMO_MODE and settings.ENV == "development":
            _mock_email_outbox.append({"to": to_email, "subject": subject, "content": html_content})
            logger.info(f"[LOCAL TEST MODE] Recorded email dispatch in mock outbox for domain: {recipient_domain}")
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
        logger.error(f"SMTP authentication failure (code {e.smtp_code}) while delivering to {recipient_domain}")
        return False
    except smtplib.SMTPRecipientsRefused:
        logger.error(f"SMTP recipient refused by provider for domain: {recipient_domain}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP protocol error ({type(e).__name__}) while delivering to {recipient_domain}")
        return False
    except Exception as e:
        logger.error(f"Unexpected connection error ({type(e).__name__}) delivering email to {recipient_domain}")
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

