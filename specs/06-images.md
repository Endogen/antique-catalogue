# Images

## Overview

Items can have multiple images. Images are uploaded, processed (resize, thumbnail), and stored on disk. Upload verification ensures integrity.

## Storage Structure

```
uploads/
├── {user_uuid}/
│   ├── {collection_uuid}/
│   │   ├── {item_uuid}/
│   │   │   ├── {image_uuid}_original.jpg   # Full resolution
│   │   │   ├── {image_uuid}_medium.jpg     # 800x800 max
│   │   │   └── {image_uuid}_thumb.jpg      # 200x200 max
```

**Benefits**:
- Fast retrieval by path
- Easy cleanup when deleting user/collection/item
- No database lookup needed for file paths
- Scalable to millions of images

## Upload Flow

### Web Upload

```
1. User selects file(s) or drags & drops
2. Client shows preview with rotate/crop options
3. User adjusts and confirms
4. Client uploads processed image
5. Server validates, generates variants, stores
6. Server returns image metadata with URLs
```

### Mobile Upload

```
1. User takes photo or selects from gallery
2. App shows preview with rotate/crop options
3. User confirms
4. App calculates checksum
5. App uploads with checksum header
6. Server validates checksum matches
7. Server confirms or requests retry
```

## API Endpoints

### Upload Image

```
POST /collections/{cid}/items/{iid}/images
Content-Type: multipart/form-data

Form fields:
- file: The image file
- display_order: Optional, integer
- is_primary: Optional, boolean

Headers:
- X-Content-Checksum: SHA-256 of file (for verification)

Response:
{
  "id": "uuid",
  "filename": "abc123_original.jpg",
  "original_filename": "desk_photo.jpg",
  "url": "/uploads/.../abc123_original.jpg",
  "thumbnail_url": "/uploads/.../abc123_thumb.jpg",
  "medium_url": "/uploads/.../abc123_medium.jpg",
  "file_size": 2345678,
  "width": 4000,
  "height": 3000,
  "checksum": "sha256:abcd1234...",
  "is_primary": true,
  "display_order": 0,
  "created_at": "..."
}
```

### Upload Verification

If `X-Content-Checksum` header is provided:
1. Server computes SHA-256 of received file
2. Compares with provided checksum
3. If mismatch: Returns `400 checksum_mismatch`
4. Client should retry upload

```
Response on mismatch:
{
  "error": "checksum_mismatch",
  "message": "File checksum does not match. Expected: abc123, Got: def456",
  "should_retry": true
}
```

### Pre-Upload Processing (Client-Side)

Before upload, client can:
1. **Rotate**: 90°, 180°, 270° clockwise
2. **Crop**: Select region of interest
3. **Compress**: Reduce quality for faster upload

```
POST /collections/{cid}/items/{iid}/images
Form fields:
- file: Processed image
- rotation: 0, 90, 180, 270 (server applies if client didn't)
- crop: {x, y, width, height} (server applies if client didn't)
```

### Server-Side Processing

On upload, server:
1. Validates file type (JPEG, PNG, WebP, HEIC)
2. Validates file size (max 20MB)
3. Applies rotation/crop if specified
4. Strips EXIF data (privacy)
5. Generates variants:
   - Original: Max 4096x4096, quality 90
   - Medium: Max 800x800, quality 85
   - Thumbnail: Max 200x200, quality 80
6. Computes checksums
7. Saves to disk
8. Creates database record

### Update Image

```
PATCH /collections/{cid}/items/{iid}/images/{img_id}
{
  "is_primary": true,
  "display_order": 0
}
```

### Reorder Images

```
PUT /collections/{cid}/items/{iid}/images/order
{
  "order": ["img_id_1", "img_id_2", "img_id_3"]
}
```

### Delete Image

```
DELETE /collections/{cid}/items/{iid}/images/{img_id}

- Removes all variants from disk
- Removes database record
- If was primary, next image becomes primary
```

### Rotate/Crop Existing Image

```
POST /collections/{cid}/items/{iid}/images/{img_id}/transform
{
  "rotation": 90,
  "crop": {
    "x": 100,
    "y": 100,
    "width": 800,
    "height": 600
  }
}

- Creates new variants from original
- Replaces existing files
- Updates dimensions in database
```

## Image Serving

### Direct File Serving

```
GET /uploads/{user_id}/{collection_id}/{item_id}/{filename}

- Served by FastAPI static files (dev)
- Or by Nginx directly (production)
- Cache headers: max-age=31536000 (1 year)
```

### Signed URLs (Optional)

For private collections:
```
GET /images/{image_id}/signed?variant=medium&expires=3600

Response:
{
  "url": "/uploads/...?sig=abc123&exp=1234567890"
}
```

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| JPEG | .jpg, .jpeg | Primary format |
| PNG | .png | Converted to JPEG on upload |
| WebP | .webp | Converted to JPEG on upload |
| HEIC | .heic | Converted to JPEG on upload (iOS) |

## Size Limits

| Constraint | Limit |
|------------|-------|
| Max file size | 20 MB |
| Max dimensions | 4096 x 4096 |
| Min dimensions | 100 x 100 |
| Max images per item | 20 |

## Error Handling

| Error | Code | Description |
|-------|------|-------------|
| file_too_large | 400 | Exceeds 20MB |
| invalid_format | 400 | Not a supported image |
| dimensions_too_small | 400 | Below 100x100 |
| dimensions_too_large | 400 | Above 4096x4096 |
| checksum_mismatch | 400 | Upload corrupted |
| max_images_reached | 400 | Item has 20 images |

## Cleanup

When deleting:
- **Item**: Delete all images in `{item_uuid}/` folder
- **Collection**: Delete all items' images in `{collection_uuid}/` folder
- **User**: Delete everything in `{user_uuid}/` folder

Background job cleans orphaned files weekly.
