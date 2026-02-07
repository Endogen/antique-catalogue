# Testing Strategy

## Goal

**80% code coverage** across the backend, with meaningful tests that verify functionality, not just lines.

## Test Types

### 1. Unit Tests
Test individual functions and classes in isolation.

**Coverage:** Services, utilities, validators

```python
# Example: test_validators.py
def test_email_validation():
    assert validate_email("user@example.com") == True
    assert validate_email("invalid") == False

def test_password_strength():
    assert validate_password("Abc12345") == True
    assert validate_password("weak") == False
```

### 2. Integration Tests
Test API endpoints with database.

**Coverage:** All API routes

```python
# Example: test_auth.py
async def test_register_success(client: AsyncClient, db: AsyncSession):
    response = await client.post("/api/v1/auth/register", json={
        "email": "new@example.com",
        "password": "SecurePass123"
    })
    assert response.status_code == 201
    
    # Verify user created
    user = await db.execute(select(User).where(User.email == "new@example.com"))
    assert user.scalar_one_or_none() is not None

async def test_register_duplicate_email(client, db, existing_user):
    response = await client.post("/api/v1/auth/register", json={
        "email": existing_user.email,
        "password": "SecurePass123"
    })
    assert response.status_code == 409
    assert response.json()["error"] == "email_exists"
```

### 3. End-to-End Tests
Test complete user flows.

```python
# Example: test_item_workflow.py
async def test_complete_item_workflow(auth_client):
    # 1. Create collection
    collection = await create_collection(auth_client, "Test Collection")
    
    # 2. Add field definitions
    await add_field(auth_client, collection["id"], {
        "name": "Condition",
        "field_type": "select",
        "options": {"choices": [{"value": "good", "label": "Good"}]}
    })
    
    # 3. Create item
    item = await create_item(auth_client, collection["id"], {
        "name": "Test Item",
        "metadata": {"Condition": "good"}
    })
    
    # 4. Upload image
    image = await upload_image(auth_client, item["id"], "test.jpg")
    
    # 5. Verify item has image
    fetched = await get_item(auth_client, collection["id"], item["id"])
    assert len(fetched["images"]) == 1
    assert fetched["images"][0]["checksum"] == image["checksum"]
```

## Test Structure

```
backend/
├── tests/
│   ├── conftest.py          # Fixtures
│   ├── unit/
│   │   ├── test_validators.py
│   │   ├── test_auth_utils.py
│   │   ├── test_image_processing.py
│   │   └── test_metadata_validation.py
│   ├── integration/
│   │   ├── test_auth.py
│   │   ├── test_collections.py
│   │   ├── test_items.py
│   │   ├── test_images.py
│   │   └── test_mobile.py
│   ├── e2e/
│   │   ├── test_workflows.py
│   │   └── test_mobile_pairing.py
│   └── fixtures/
│       ├── images/
│       │   ├── test_small.jpg
│       │   ├── test_large.jpg
│       │   └── test_corrupt.jpg
│       └── data/
│           └── sample_metadata.json
```

## Fixtures

```python
# conftest.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.fixture
async def db() -> AsyncSession:
    """Fresh database for each test."""
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db) -> AsyncClient:
    """HTTP client with test database."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
async def user(db) -> User:
    """Create and return a verified test user."""
    user = User(email="test@example.com", password_hash="...")
    user.is_verified = True
    db.add(user)
    await db.commit()
    return user

@pytest.fixture
async def auth_client(client, user) -> AsyncClient:
    """Authenticated client."""
    response = await client.post("/api/v1/auth/login", json={
        "email": user.email,
        "password": "password"
    })
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client

@pytest.fixture
async def collection(auth_client, db) -> dict:
    """Create a test collection with fields."""
    response = await auth_client.post("/api/v1/collections", json={
        "name": "Test Collection"
    })
    return response.json()
```

## Key Test Cases

### Auth Tests
- [ ] Register with valid data
- [ ] Register with duplicate email
- [ ] Register with weak password
- [ ] Verify email with valid token
- [ ] Verify with expired/invalid token
- [ ] Login with correct credentials
- [ ] Login with wrong password
- [ ] Login with unverified email
- [ ] Token refresh
- [ ] Password reset flow

### Collection Tests
- [ ] Create collection
- [ ] List collections (pagination)
- [ ] Update collection
- [ ] Delete collection (cascading)
- [ ] Add field definitions (all types)
- [ ] Update field definitions
- [ ] Reorder fields

### Item Tests
- [ ] Create item with all field types
- [ ] Validate required fields
- [ ] Validate field types
- [ ] Update item (partial)
- [ ] Delete item (cascading images)
- [ ] Search items
- [ ] Filter by metadata
- [ ] Sort by metadata
- [ ] Bulk operations

### Image Tests
- [ ] Upload valid image
- [ ] Upload with checksum verification
- [ ] Upload checksum mismatch
- [ ] Upload too large file
- [ ] Upload invalid format
- [ ] Rotate image
- [ ] Crop image
- [ ] Delete image
- [ ] Reorder images
- [ ] Thumbnail generation

### Mobile Tests
- [ ] Generate pairing code
- [ ] Complete pairing
- [ ] Reject expired code
- [ ] List linked devices
- [ ] Unlink device
- [ ] Mobile token refresh

## Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/integration/test_auth.py

# Specific test
pytest -k "test_register_success"

# Verbose
pytest -v

# Stop on first failure
pytest -x
```

## Coverage Requirements

| Component | Target |
|-----------|--------|
| API Routes | 90% |
| Services | 85% |
| Models | 80% |
| Utils | 80% |
| **Overall** | **80%** |

## CI Integration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - run: pip install -e .[test]
    - run: pytest --cov=app --cov-report=xml
    - uses: codecov/codecov-action@v4
```

## Mocking

```python
# Mock email sending
@pytest.fixture
def mock_email(mocker):
    return mocker.patch("app.services.email.send_email")

async def test_register_sends_email(client, mock_email):
    await client.post("/api/v1/auth/register", json={...})
    mock_email.assert_called_once()

# Mock image processing
@pytest.fixture
def mock_image_processor(mocker):
    return mocker.patch("app.services.images.process_image")
```

## Test Database

- SQLite in-memory for speed
- Fresh database per test (rollback)
- Fixtures for common data
- No shared state between tests
