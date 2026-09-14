"""Filesystem layout and lifecycle for uploaded images.

Single source of truth for where item images and avatars live on disk:

    {uploads_dir}/{owner_id}/{collection_id}/{item_id}/{image_id}_{variant}.jpg
    {uploads_dir}/avatars/{user_id}/avatar_{variant}.jpg

Deletion helpers are best-effort: the database row is the source of truth,
so failures to remove files are logged instead of surfacing to the client.
"""

from __future__ import annotations

import logging
import shutil
from contextlib import contextmanager
from pathlib import Path

from app.core.settings import settings

logger = logging.getLogger(__name__)

AVATAR_DIR_NAME = "avatars"


def item_upload_dir(owner_id: int, collection_id: int, item_id: int) -> Path:
    return settings.uploads_dir / str(owner_id) / str(collection_id) / str(item_id)


def collection_upload_dir(owner_id: int, collection_id: int) -> Path:
    return settings.uploads_dir / str(owner_id) / str(collection_id)


def user_upload_dir(owner_id: int) -> Path:
    return settings.uploads_dir / str(owner_id)


def avatar_upload_dir(user_id: int) -> Path:
    return settings.uploads_dir / AVATAR_DIR_NAME / str(user_id)


def _remove_tree(path: Path) -> None:
    try:
        shutil.rmtree(path)
    except FileNotFoundError:
        return
    except OSError:
        logger.warning("Failed to remove upload directory %s", path, exc_info=True)


def delete_item_uploads(owner_id: int, collection_id: int, item_id: int) -> None:
    _remove_tree(item_upload_dir(owner_id, collection_id, item_id))


def delete_collection_uploads(owner_id: int, collection_id: int) -> None:
    _remove_tree(collection_upload_dir(owner_id, collection_id))


def delete_user_uploads(user_id: int) -> None:
    _remove_tree(user_upload_dir(user_id))
    _remove_tree(avatar_upload_dir(user_id))


@contextmanager
def move_item_uploads(
    owner_id: int,
    source_collection_id: int,
    target_collection_id: int,
    item_id: int,
):
    """Stage a copy, commit the database inside the context, then remove the source.

    A copy/commit failure leaves the source intact and removes only this attempt's
    staged directory. The caller must roll back its database transaction.
    """
    source = item_upload_dir(owner_id, source_collection_id, item_id)
    if not source.exists():
        yield
        return
    target = item_upload_dir(owner_id, target_collection_id, item_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Reserve the destination atomically so we never remove another move's files.
    target.mkdir()
    try:
        shutil.copytree(source, target, dirs_exist_ok=True)
        yield
    except BaseException:
        _remove_tree(target)
        raise
    else:
        _remove_tree(source)
