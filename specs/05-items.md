# Items

## Overview
Items are the core entities. Each item belongs to a collection and stores values for that collection's schema fields.

## Properties
- `id`: UUID
- `collection_id`: foreign key
- `name`: string (required)
- `metadata`: JSON (field values per schema)
- `notes`: text (optional)
- `created_at`, `updated_at`: timestamps

## Metadata Storage
```json
{
  "Purchase Date": "2024-06-15",
  "Purchase Price": 2500.00,
  "Condition": "Excellent"
}
```

## Endpoints
```
GET    /collections/{cid}/items           # List items
POST   /collections/{cid}/items           # Create item
GET    /collections/{cid}/items/{id}      # Get item
PATCH  /collections/{cid}/items/{id}      # Update item
DELETE /collections/{cid}/items/{id}      # Delete item
```

## List Features
- **Search**: Full-text on name and notes
- **Filter**: By metadata field values
- **Sort**: By name, created_at, or metadata fields
- **Pagination**: Offset/limit or cursor

## Public Access
- Items in public collections viewable without auth
- Read-only (no create/edit/delete)

## Cascade Delete
Deleting an item deletes all its images (files on disk)
