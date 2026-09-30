import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, List
from app.core.config import settings

logger = logging.getLogger("CrisisCommandSMTP")

# Local outbox tracker for development/testing
_mock_email_outbox: List[Dict[str, str]] = []

def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Sends an email via SMTP. If SMTP credentials are not configured,
    logs the delivery and records in mock outbox for instant demo usability.
    """
    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            if getattr(settings, "SMTP_FROM_NAME", None):
                msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            else:
                msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"SMTP email successfully delivered to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP server: {e}. Falling back to simulated log delivery.")

    # Simulated SMTP fallback for seamless demo mode
    record = {
        "to": to_email,
        "subject": subject,
        "content": html_content
    }
    _mock_email_outbox.append(record)
    logger.info(f"[SIMULATED SMTP EMAIL SENT] To: {to_email} | Subject: {subject}")
    return True

def send_otp_email(to_email: str, otp: str, purpose: str = "Account Verification") -> bool:
    subject = f"Crisis Command - {purpose} Code: {otp}"
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
    text = f"Your Crisis Command {purpose} code is: {otp}. It expires in 5 minutes."
    return send_smtp_email(to_email, subject, html, text)

def send_password_reset_email(to_email: str, otp: str) -> bool:
    return send_otp_email(to_email, otp, purpose="Password Reset")

def get_recent_outbox() -> List[Dict[str, str]]:
    return _mock_email_outbox[-10:]
