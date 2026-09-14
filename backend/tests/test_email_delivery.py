import smtplib
from unittest.mock import MagicMock

import pytest

from app.core.settings import settings
from app.services import email

_real_send_email = email.send_email


def test_email_links_and_retry_failure(monkeypatch):
    # Restore the real sender after the suite's no-network fixture.
    module = email
    monkeypatch.setattr(module, "send_email", _real_send_email)
    previous = (settings.smtp_host, settings.smtp_from)
    object.__setattr__(settings, "smtp_host", "localhost")
    object.__setattr__(settings, "smtp_from", "test@example.com")
    monkeypatch.setattr(module.time, "sleep", lambda delay: None)
    smtp = MagicMock()
    smtp.return_value.__enter__.return_value.send_message.side_effect = [
        smtplib.SMTPServerDisconnected(),
        None,
    ]
    monkeypatch.setattr(module.smtplib, "SMTP", smtp)
    try:
        module.send_verification_email("test@example.com", "test token")
        assert smtp.call_count == 2
        body = smtp.return_value.__enter__.return_value.send_message.call_args[0][0].get_content()
        assert "/verify?token=test+token" in body
        smtp.reset_mock()
        smtp.return_value.__enter__.return_value.send_message.side_effect = (
            smtplib.SMTPServerDisconnected()
        )
        with pytest.raises(module.EmailDeliveryError):
            module.send_password_reset_email("test@example.com", "reset token")
        assert smtp.call_count == 3
        body = smtp.return_value.__enter__.return_value.send_message.call_args[0][0].get_content()
        assert "/reset-password?token=reset+token" in body
    finally:
        object.__setattr__(settings, "smtp_host", previous[0])
        object.__setattr__(settings, "smtp_from", previous[1])
