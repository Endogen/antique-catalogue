# Mobile Companion App (Android)

## Overview

A companion Android app that pairs with the web platform to capture photos and enter item metadata on the go. The app is intentionally simple — focused on data entry, not full management.

## Tech Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose + Material 3
- **Camera**: CameraX
- **Networking**: Retrofit + OkHttp
- **Storage**: DataStore (preferences), Room (offline queue)
- **DI**: Hilt
- **Build**: Gradle with Kotlin DSL

## Pairing Flow

### Web Side: Generate Pairing Code

```
POST /mobile/pair
{
  "collection_id": "uuid",  // Optional: pre-select collection
  "device_name": "My Phone"  // Optional
}

Response:
{
  "pairing_code": "ABC12345",  // 8-char alphanumeric
  "expires_at": "2026-02-07T10:10:00Z",  // 10 minutes
  "qr_data": "antique://pair?code=ABC12345&server=https://example.com"
}
```

Web shows:
1. QR code (encodes `qr_data`)
2. Text code for manual entry

### App Side: Complete Pairing

```
# Scan QR or enter code manually
POST {server}/mobile/pair/confirm
{
  "pairing_code": "ABC12345",
  "device_id": "android-device-uuid",
  "device_name": "Pixel 8",
  "device_info": {
    "model": "Pixel 8",
    "os_version": "Android 14",
    "app_version": "1.0.0"
  }
}

Response:
{
  "access_token": "jwt...",
  "refresh_token": "jwt...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "collection": {  // If pre-selected
    "id": "uuid",
    "name": "Antique Furniture"
  },
  "collections": [  // All user's collections
    {"id": "uuid", "name": "Collection 1"},
    {"id": "uuid", "name": "Collection 2"}
  ],
  "server_url": "https://example.com"
}
```

### Token Management

- **Access token**: 7 days (longer than web for convenience)
- **Refresh token**: 30 days
- Stored in Android EncryptedSharedPreferences

### Unpairing

From web:
```
DELETE /mobile/links/{link_id}
```

From app:
- Clear tokens and local data
- Show pairing screen

## App Screens

### 1. Pairing Screen
- QR scanner (CameraX)
- Manual code entry field
- Server URL input (for self-hosted)

### 2. Home / Collection List
- List of paired collections
- Last used collection highlighted
- Pull to refresh
- Tap collection → Item Entry

### 3. Item Entry Screen
- **Item name** field (required)
- **Dynamic metadata fields** based on collection schema
- **Photo section**:
  - Take Photo button (opens camera)
  - Gallery button (pick existing)
  - Thumbnail previews of attached photos
  - Tap thumbnail → preview with rotate/crop/delete
- **Notes** field (multiline)
- **Save** button

### 4. Camera Screen
- Full-screen camera preview
- Capture button
- Flash toggle
- Front/back toggle
- After capture:
  - Preview with rotate/crop options
  - Confirm → return to Item Entry
  - Retake → back to camera

### 5. Image Preview/Edit
- Full-screen image
- Rotate buttons (90° left/right)
- Crop tool (drag corners)
- Delete button
- Save button

### 6. Upload Queue
- List of pending uploads
- Progress indicators
- Retry failed uploads
- Clear completed

### 7. Settings
- Linked account info
- Selected collection
- Image quality (High/Medium/Low)
- Auto-upload on WiFi only
- Unlink device

## Offline Support

### Queue System

When offline:
1. Item saved to local Room database
2. Images saved to app cache
3. Shown in Upload Queue with "Pending" status

When online:
1. Background worker processes queue
2. Creates item on server
3. Uploads images with checksums
4. Verifies each upload
5. Removes from local queue on success
6. Retries failures (max 3 times)

### Data Model (Room)

```kotlin
@Entity
data class PendingItem(
    @PrimaryKey val localId: String,
    val collectionId: String,
    val name: String,
    val metadata: String,  // JSON
    val notes: String?,
    val status: UploadStatus,
    val createdAt: Long,
    val serverItemId: String?  // Filled after sync
)

@Entity
data class PendingImage(
    @PrimaryKey val localId: String,
    val pendingItemId: String,
    val localPath: String,
    val checksum: String,
    val status: UploadStatus,
    val displayOrder: Int
)

enum class UploadStatus {
    PENDING, UPLOADING, UPLOADED, FAILED
}
```

## API Endpoints (Mobile-Specific)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mobile/pair | Generate pairing code |
| POST | /mobile/pair/confirm | Complete pairing |
| GET | /mobile/links | List linked devices |
| DELETE | /mobile/links/{id} | Remove device |
| POST | /mobile/refresh | Refresh token |
| GET | /mobile/collections | List collections |
| GET | /mobile/collections/{id}/schema | Get field definitions |
| POST | /mobile/collections/{id}/items | Create item |
| POST | /mobile/items/{id}/images | Upload image |

## Image Upload Flow

```kotlin
suspend fun uploadImage(image: PendingImage): Result<ImageResponse> {
    // 1. Read file
    val file = File(image.localPath)
    
    // 2. Compute checksum
    val checksum = file.sha256()
    
    // 3. Create multipart request
    val body = MultipartBody.Builder()
        .addFormDataPart("file", file.name, file.asRequestBody())
        .addFormDataPart("display_order", image.displayOrder.toString())
        .build()
    
    // 4. Upload with checksum header
    val response = api.uploadImage(
        itemId = image.pendingItemId,
        body = body,
        checksum = "sha256:$checksum"
    )
    
    // 5. Verify response checksum matches
    if (response.checksum != "sha256:$checksum") {
        return Result.failure(ChecksumMismatchException())
    }
    
    return Result.success(response)
}
```

## Permissions

Required:
- `CAMERA` — Taking photos
- `INTERNET` — API communication

Optional:
- `READ_MEDIA_IMAGES` — Selecting from gallery

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No internet | Queue for later, show status |
| Token expired | Auto-refresh, retry once |
| Upload failed | Retry 3x, then mark failed |
| Checksum mismatch | Delete local, request retry |
| Session revoked | Clear data, show pair screen |

## Push Notifications (Future)

Could add:
- Upload complete confirmation
- Collection shared with you
- Item added from another device
