import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def test_migrations_preserve_legacy_values_and_match_models(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    database = tmp_path / "migrations.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{database}"}

    def alembic(*args):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend,
            env=env,
            text=True,
            capture_output=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr

    alembic("upgrade", "0015_add_activity_context")
    with sqlite3.connect(database) as db:
        db.execute(
            "INSERT INTO users (id,email,username,password_hash,is_active,is_verified) "
            "VALUES (1,'test@example.com','test','unused',1,1)"
        )
        db.execute(
            "INSERT INTO collections (id,owner_id,name,is_public,is_featured) "
            "VALUES (1,1,'Test',1,0)"
        )
        db.execute(
            "INSERT INTO field_definitions "
            "(collection_id,name,field_type,is_required,is_private,position) "
            "VALUES (1,'Maker','text',0,0,0)"
        )
        db.execute(
            "INSERT INTO items (collection_id,name,metadata,is_featured,is_highlight,is_draft) "
            "VALUES (1,'Vase',?,0,0,0)",
            [json.dumps({"Maker": "Meissen", "Lost field": "Private history"})],
        )
    alembic("upgrade", "head")
    alembic("check")
    with sqlite3.connect(database) as db:
        metadata, preserved = db.execute("SELECT metadata,preserved_metadata FROM items").fetchone()
        assert json.loads(metadata) == {"Maker": "Meissen"}
        assert json.loads(preserved)[0]["value"] == "Private history"
    alembic("downgrade", "0015_add_activity_context")
    with sqlite3.connect(database) as db:
        assert json.loads(db.execute("SELECT metadata FROM items").fetchone()[0]) == {
            "Maker": "Meissen",
            "Lost field": "Private history",
        }
    alembic("upgrade", "head")
    alembic("check")
