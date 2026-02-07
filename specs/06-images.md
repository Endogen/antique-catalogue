# Images

## Overview
Items can have multiple images. Images are optional but expected in most cases.

## Upload Sources
- **Desktop**: Local file upload
- **Mobile web**: Browser camera capture (via `<input type="file" capture="environment">`)

## Processing
- **Input**: Any image format
- **Output**: Always JPG (server converts)
- **Variants**:
  - `original.jpg`: Full resolution
  - `medium.jpg`: Max 800x800
  - `thumb.jpg`: Max 200x200

## Storage Structure
```
uploads/
└── {user_id}/
    └── {collection_id}/
        └── {item_id}/
            ├── {image_id}_original.jpg
            ├── {image_id}_medium.jpg
            └── {image_id}_thumb.jpg
```

## Properties
- `id`: UUID
- `item_id`: foreign key
- `filename`: original filename
- `position`: integer (ordering)
- `created_at`: timestamp

## Endpoints
```
POST   /items/{iid}/images              # Upload image
GET    /items/{iid}/images              # List images
PATCH  /items/{iid}/images/{id}         # Update (reorder)
DELETE /items/{iid}/images/{id}         # Delete image
GET    /images/{id}/{variant}.jpg       # Serve image file
```

## Limits
- Max file size: 10MB per image
- Formats: JPG, PNG, WebP, HEIC (converted to JPG)

## Cleanup
- Deleting image removes files from disk
- Orphan cleanup job for failed uploads
