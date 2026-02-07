# Collections

## Overview
Collections are user-created containers for items. Each collection has a custom metadata schema.

## Properties
- `id`: UUID
- `name`: string (required)
- `description`: string (optional)
- `is_public`: boolean (default: false)
- `created_at`, `updated_at`: timestamps
- `owner_id`: foreign key to User

## Visibility
- **Private** (default): Only owner can view/edit
- **Public**: Anyone can view (read-only), listed in public directory

## Endpoints
```
GET    /collections              # List user's collections
POST   /collections              # Create collection
GET    /collections/{id}         # Get collection details
PATCH  /collections/{id}         # Update collection
DELETE /collections/{id}         # Delete collection (cascades)

GET    /public/collections       # Public directory (no auth)
GET    /public/collections/{id}  # View public collection (no auth)
```

## Cascade Delete
Deleting a collection deletes:
- All field definitions
- All items
- All item images (files on disk)
