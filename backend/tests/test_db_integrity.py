from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.models.collection import Collection
from app.models.collection_star import CollectionStar
from app.models.email_token import EmailToken
from app.models.field_definition import FieldDefinition
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.item_star import ItemStar
from app.models.user import User


def _seed_user_with_collection(session) -> tuple[int, int, int, int]:
    user = User(
        email="cascade@example.com",
        password_hash=hash_password("strongpass"),
        is_verified=True,
    )
    session.add(user)
    session.flush()
    user.username = str(user.id)

    collection = Collection(owner_id=user.id, name="Cascade", is_public=True)
    session.add(collection)
    session.flush()

    field = FieldDefinition(
        collection_id=collection.id,
        name="Maker",
        field_type="text",
        position=1,
    )
    item = Item(collection_id=collection.id, name="Item")
    session.add_all([field, item])
    session.flush()

    image = ItemImage(item_id=item.id, filename="photo.jpg", position=0)
    collection_star = CollectionStar(collection_id=collection.id, user_id=user.id)
    item_star = ItemStar(item_id=item.id, user_id=user.id)
    token = EmailToken(
        user_id=user.id,
        token="cascade-token",
        token_type="verify",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    session.add_all([image, collection_star, item_star, token])
    session.commit()
    return user.id, collection.id, item.id, image.id


def test_deleting_collection_cascades_to_children(db_session_factory) -> None:
    session = db_session_factory()
    try:
        _, collection_id, item_id, image_id = _seed_user_with_collection(session)

        collection = session.get(Collection, collection_id)
        session.delete(collection)
        session.commit()

        assert session.get(Item, item_id) is None
        assert session.get(ItemImage, image_id) is None
        assert (
            session.execute(
                select(FieldDefinition.id).where(
                    FieldDefinition.collection_id == collection_id
                )
            ).first()
            is None
        )
        assert (
            session.execute(
                select(CollectionStar.id).where(
                    CollectionStar.collection_id == collection_id
                )
            ).first()
            is None
        )
        assert (
            session.execute(select(ItemStar.id).where(ItemStar.item_id == item_id)).first()
            is None
        )
    finally:
        session.close()


def test_deleting_user_cascades_to_all_owned_rows(db_session_factory) -> None:
    session = db_session_factory()
    try:
        user_id, collection_id, item_id, image_id = _seed_user_with_collection(session)

        user = session.get(User, user_id)
        session.delete(user)
        session.commit()

        assert session.get(Collection, collection_id) is None
        assert session.get(Item, item_id) is None
        assert session.get(ItemImage, image_id) is None
        assert (
            session.execute(
                select(EmailToken.id).where(EmailToken.user_id == user_id)
            ).first()
            is None
        )
    finally:
        session.close()
