# Items

## Overview

Items are the core entities in collections. Each item has a name, dynamic metadata (based on collection schema), optional notes, and images.

## Item CRUD

### Create Item

```
POST /collections/{collection_id}/items
{
  "name": "Victorian Writing Desk",
  "metadata": {
    "Purchase Date": "2024-06-15",
    "Purchase Price": 2500.00,
    "Purchase Location": "Estate sale, London",
    "Estimated Age (years)": 150,
    "Dimensions": "120 x 60 x 90 cm",
    "Weight (kg)": 45.5,
    "Condition": "good",
    "Materials": ["oak", "brass", "leather"],
    "Authenticated": true
  },
  "notes": "Has original brass hardware. Minor scratches on top surface."
}

Response:
{
  "id": "uuid",
  "collection_id": "uuid",
  "name": "Victorian Writing Desk",
  "metadata": {...},
  "notes": "...",
  "images": [],
  "created_at": "2026-02-07T10:00:00Z",
  "updated_at": "2026-02-07T10:00:00Z"
}
```

### Validation

- **name**: Required, max 200 chars
- **metadata**: Validated against collection's field_definitions
  - Required fields must be present
  - Types must match (number, date, etc.)
  - Select values must be from defined choices
- **notes**: Optional, no limit

### List Items

```
GET /collections/{collection_id}/items
GET /collections/{collection_id}/items?search=desk&sort=created_at&order=desc

Query Parameters:
- search: Full-text search in name and notes
- sort: Field to sort by (name, created_at, updated_at, or any metadata field)
- order: asc or desc
- page: Page number (default 1)
- per_page: Items per page (default 20, max 100)
- filter[field_name]: Filter by metadata value

Response:
{
  "items": [
    {
      "id": "uuid",
      "name": "Victorian Writing Desk",
      "metadata": {...},
      "notes": "...",
      "primary_image": {
        "id": "uuid",
        "thumbnail_url": "/uploads/.../thumb.jpg"
      },
      "image_count": 3,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

### Get Item

```
GET /collections/{collection_id}/items/{id}

Response:
{
  "id": "uuid",
  "collection_id": "uuid",
  "name": "Victorian Writing Desk",
  "metadata": {...},
  "notes": "...",
  "images": [
    {
      "id": "uuid",
      "filename": "abc123_original.jpg",
      "original_filename": "desk_front.jpg",
      "url": "/uploads/.../abc123_original.jpg",
      "thumbnail_url": "/uploads/.../abc123_thumb.jpg",
      "medium_url": "/uploads/.../abc123_medium.jpg",
      "file_size": 1234567,
      "width": 4000,
      "height": 3000,
      "is_primary": true,
      "display_order": 0,
      "created_at": "..."
    }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

### Update Item

```
PATCH /collections/{collection_id}/items/{id}
{
  "name": "Updated Name",
  "metadata": {
    "Condition": "excellent"
  },
  "notes": "Updated notes"
}
```

**Partial Updates**:
- Only provided fields are updated
- Metadata is merged (not replaced entirely)
- To remove a metadata field value, set it to null

### Delete Item

```
DELETE /collections/{collection_id}/items/{id}

- Deletes item and all associated images
- Images are removed from filesystem
```

### Bulk Operations

```
POST /collections/{collection_id}/items/bulk
{
  "action": "delete",
  "item_ids": ["uuid1", "uuid2", "uuid3"]
}

POST /collections/{collection_id}/items/bulk
{
  "action": "update",
  "item_ids": ["uuid1", "uuid2"],
  "data": {
    "metadata": {
      "Condition": "good"
    }
  }
}
```

## Search & Filtering

### Full-Text Search

```
GET /collections/{id}/items?search=victorian+desk

Searches in:
- Item name
- Item notes
- Text/textarea metadata fields
```

### Metadata Filtering

```
# Exact match
GET /items?filter[Condition]=excellent

# Numeric range
GET /items?filter[Purchase Price][gte]=1000&filter[Purchase Price][lte]=5000

# Date range
GET /items?filter[Purchase Date][gte]=2024-01-01&filter[Purchase Date][lte]=2024-12-31

# Boolean
GET /items?filter[Authenticated]=true

# Multiple values (OR)
GET /items?filter[Condition][]=excellent&filter[Condition][]=good

# Multiselect contains
GET /items?filter[Materials][contains]=oak
```

### Sorting

```
# By name
GET /items?sort=name&order=asc

# By creation date (newest first)
GET /items?sort=created_at&order=desc

# By metadata field
GET /items?sort=metadata.Purchase Price&order=desc
```

## Views

### Grid View (default)
- Thumbnail images
- Item name
- Primary metadata preview
- Suitable for visual browsing

### List View
- Compact rows
- More metadata visible
- Better for data comparison

### Detail View
- Full item with all images
- Complete metadata
- Edit capabilities

## Export

```
GET /collections/{id}/items/export?format=csv
GET /collections/{id}/items/export?format=json

CSV columns:
- id, name, notes, created_at, updated_at
- All metadata fields as columns
- primary_image_url
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /collections/{cid}/items | List items |
| POST | /collections/{cid}/items | Create item |
| GET | /collections/{cid}/items/{id} | Get item |
| PATCH | /collections/{cid}/items/{id} | Update item |
| DELETE | /collections/{cid}/items/{id} | Delete item |
| POST | /collections/{cid}/items/bulk | Bulk operations |
| GET | /collections/{cid}/items/export | Export items |
