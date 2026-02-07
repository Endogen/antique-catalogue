# API Reference

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

### Headers
```
Authorization: Bearer <access_token>
```

### Cookie (Web)
```
Cookie: refresh_token=<refresh_token>
```

## Response Format

### Success
```json
{
  "data": { ... },
  "message": "Optional message"
}
```

### Error
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { ... }
}
```

### Pagination
```json
{
  "items": [ ... ],
  "total": 100,
  "page": 1,
  "per_page": 20,
  "pages": 5
}
```

---

## Auth Endpoints

### POST /auth/register
Create new account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:** `201 Created`
```json
{
  "message": "Verification email sent"
}
```

### GET /auth/verify
Verify email with token.

**Query:** `?token=abc123...`

**Response:** `200 OK`

### POST /auth/login
Authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "jwt...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John"
  }
}
```
Also sets `refresh_token` cookie.

### POST /auth/refresh
Get new access token.

**Cookie:** `refresh_token`

**Response:** `200 OK`
```json
{
  "access_token": "jwt...",
  "expires_in": 900
}
```

### POST /auth/logout
Invalidate session.

**Response:** `200 OK`

### POST /auth/forgot
Request password reset.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`

### POST /auth/reset
Reset password with token.

**Request:**
```json
{
  "token": "abc123...",
  "password": "NewSecurePass123"
}
```

**Response:** `200 OK`

### GET /auth/me
Get current user.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John",
  "is_verified": true,
  "created_at": "..."
}
```

---

## Collection Endpoints

### GET /collections
List user's collections.

**Query:**
- `search`: Search by name
- `page`: Page number
- `per_page`: Items per page

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Victorian Furniture",
      "description": "...",
      "item_count": 24,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 5,
  "page": 1,
  "per_page": 20
}
```

### POST /collections
Create collection.

**Request:**
```json
{
  "name": "Victorian Furniture",
  "description": "Furniture from 1837-1901"
}
```

**Response:** `201 Created`

### GET /collections/{id}
Get collection with schema.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Victorian Furniture",
  "description": "...",
  "item_count": 24,
  "field_definitions": [
    {
      "id": "uuid",
      "name": "Condition",
      "field_type": "select",
      "is_required": true,
      "display_order": 1,
      "options": { "choices": [...] }
    }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

### PATCH /collections/{id}
Update collection.

### DELETE /collections/{id}
Delete collection.

**Query:** `?confirm=true`

---

## Field Definition Endpoints

### POST /collections/{id}/fields
Add field to schema.

**Request:**
```json
{
  "name": "Condition",
  "field_type": "select",
  "is_required": true,
  "display_order": 1,
  "options": {
    "choices": [
      {"value": "excellent", "label": "Excellent"}
    ]
  }
}
```

### PATCH /collections/{id}/fields/{fid}
Update field.

### DELETE /collections/{id}/fields/{fid}
Delete field.

### PUT /collections/{id}/fields/order
Reorder fields.

**Request:**
```json
{
  "order": ["field_id_1", "field_id_2"]
}
```

---

## Item Endpoints

### GET /collections/{cid}/items
List items with filtering.

**Query:**
- `search`: Full-text search
- `sort`: Sort field
- `order`: asc/desc
- `page`, `per_page`
- `filter[field_name]`: Filter by metadata

### POST /collections/{cid}/items
Create item.

**Request:**
```json
{
  "name": "Victorian Desk",
  "metadata": {
    "Condition": "excellent",
    "Purchase Price": 2500
  },
  "notes": "Optional notes"
}
```

### GET /collections/{cid}/items/{id}
Get item with images.

### PATCH /collections/{cid}/items/{id}
Update item.

### DELETE /collections/{cid}/items/{id}
Delete item and images.

### POST /collections/{cid}/items/bulk
Bulk operations.

### GET /collections/{cid}/items/export
Export as CSV/JSON.

**Query:** `?format=csv`

---

## Image Endpoints

### POST /collections/{cid}/items/{iid}/images
Upload image.

**Content-Type:** `multipart/form-data`

**Headers:**
- `X-Content-Checksum`: SHA-256 hash

**Form:**
- `file`: Image file
- `display_order`: Integer
- `is_primary`: Boolean

### PATCH /items/{iid}/images/{img_id}
Update image metadata.

### PUT /items/{iid}/images/order
Reorder images.

### DELETE /items/{iid}/images/{img_id}
Delete image.

### POST /items/{iid}/images/{img_id}/transform
Rotate/crop image.

**Request:**
```json
{
  "rotation": 90,
  "crop": {"x": 0, "y": 0, "width": 800, "height": 600}
}
```

---

## Mobile Endpoints

### POST /mobile/pair
Generate pairing code.

**Request:**
```json
{
  "collection_id": "uuid",
  "device_name": "My Phone"
}
```

**Response:**
```json
{
  "pairing_code": "ABC12345",
  "qr_data": "antique://pair?...",
  "expires_at": "..."
}
```

### POST /mobile/pair/confirm
Complete pairing.

### GET /mobile/links
List linked devices.

### DELETE /mobile/links/{id}
Unlink device.

### GET /mobile/collections
List collections (mobile).

### GET /mobile/collections/{id}/schema
Get collection schema (mobile).

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| validation_error | 422 | Invalid input |
| not_found | 404 | Resource not found |
| unauthorized | 401 | Not authenticated |
| forbidden | 403 | Not authorized |
| conflict | 409 | Duplicate resource |
| rate_limited | 429 | Too many requests |
| server_error | 500 | Internal error |
