"""Run the real API on loopback with a disposable migrated DB and SMTP sink.

Used exclusively by Playwright; never import this module in the application.
"""

import os
import subprocess
import sys
import tempfile
from email import message_from_bytes
from pathlib import Path


def main():
    from aiosmtpd.controller import Controller

    inbox = []

    class Mailbox:
        async def handle_DATA(self, server, session, envelope):
            message = message_from_bytes(envelope.content)
            inbox.append(
                {"to": envelope.rcpt_tos, "body": message.get_payload(decode=True).decode()}
            )
            return "250 Message accepted"

    with tempfile.TemporaryDirectory(prefix="antique-e2e-") as directory:
        os.environ.update(
            {
                "APP_ENV": "development",
                "DATABASE_URL": f"sqlite:///{directory}/catalogue.db",
                "UPLOADS_PATH": f"{directory}/uploads",
                "AUTO_VERIFY_EMAIL": "false",
                "JWT_SECRET": "isolated-local-e2e-secret-with-at-least-32-characters",
                "SMTP_HOST": "127.0.0.1",
                "SMTP_PORT": "8411",
                "SMTP_USE_TLS": "false",
                "SMTP_FROM": "test@example.com",
                "PUBLIC_APP_URL": "http://127.0.0.1:3410",
                "REFRESH_TOKEN_COOKIE_SECURE": "false",
            }
        )
        root = Path(__file__).resolve().parents[1]
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=root, check=True)
        sys.path.insert(0, str(root))
        from datetime import timedelta

        import uvicorn

        from app.core.security import create_access_token, decode_token
        from app.main import app

        @app.get("/__test__/mailbox", include_in_schema=False)
        def mailbox():
            return inbox

        @app.post("/__test__/expire-access", include_in_schema=False)
        def expire_access(payload: dict):
            claims = decode_token(payload["token"])
            return {
                "access_token": create_access_token(
                    claims["sub"],
                    expires_delta=timedelta(seconds=-1),
                    additional_claims={"ver": claims["ver"], "sid": claims["sid"]},
                )
            }

        smtp = Controller(Mailbox(), hostname="127.0.0.1", port=8411)
        smtp.start()
        try:
            uvicorn.run(app, host="127.0.0.1", port=8410)
        finally:
            smtp.stop()


if __name__ == "__main__":
    main()
