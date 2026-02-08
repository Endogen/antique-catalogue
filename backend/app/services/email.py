from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.settings import settings

logger = logging.getLogger(__name__)


def _smtp_login(smtp: smtplib.SMTP) -> None:
    if settings.smtp_user and settings.smtp_password:
        smtp.login(settings.smtp_user, settings.smtp_password)


def send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        logger.info("SMTP not configured; skipping email to %s", to_email)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(body)

    try:
        if settings.smtp_use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
                smtp.starttls(context=context)
                _smtp_login(smtp)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
                _smtp_login(smtp)
                smtp.send_message(message)
    except Exception:
        logger.exception("Failed to send email to %s", to_email)


def send_verification_email(to_email: str, token: str) -> None:
    subject = "Verify your Antique Catalogue account"
    body = (
        "Thanks for registering. Use the verification token below to activate your account.\n\n"
        f"Verification token: {token}\n"
    )
    send_email(to_email, subject, body)
