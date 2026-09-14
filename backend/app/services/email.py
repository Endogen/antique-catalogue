from __future__ import annotations

import logging
import smtplib
import ssl
import time
from email.message import EmailMessage
from urllib.parse import urlencode

from app.core.settings import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Raised when an email cannot be accepted for delivery."""


def send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise EmailDeliveryError("SMTP is not configured")
    message = EmailMessage()
    message["Subject"], message["From"], message["To"] = subject, settings.smtp_from, to_email
    message.set_content(body)
    for attempt in range(3):
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_user and settings.smtp_password:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
            return
        except (OSError, smtplib.SMTPException) as exc:
            if attempt == 2:
                logger.error("Email delivery failed after three attempts")
                raise EmailDeliveryError("Email delivery failed") from exc
            time.sleep(0.2 * (attempt + 1))


def _link(path: str, token: str) -> str:
    return f"{settings.public_app_url.rstrip('/')}{path}?{urlencode({'token': token})}"


def send_verification_email(to_email: str, token: str) -> None:
    send_email(
        to_email,
        "Verify your Antique Catalogue account",
        (
            "Activate your account using this link (valid for 24 hours):\n\n"
            f"{_link('/verify', token)}\n\nVerification token: {token}\n"
            "If the link expires, request another email on the verification page.\n"
        ),
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    send_email(
        to_email,
        "Reset your Antique Catalogue password",
        (
            "Set a new password using this link (valid for 2 hours):\n\n"
            f"{_link('/reset-password', token)}\n\nPassword reset token: {token}\n"
        ),
    )
