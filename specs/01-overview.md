# Overview

## Goal
Build a modern web platform for cataloguing antique items with a companion Android app for mobile photo capture and metadata entry.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│  FastAPI Backend │────▶│     SQLite      │
│   (Frontend)    │     │    (Python)      │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ REST API
                               ▼
                        ┌─────────────────┐
                        │  Android App    │
                        │  (Companion)    │
                        └─────────────────┘
```

## Tech Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **Database**: SQLite with SQLAlchemy ORM
- **Auth**: JWT tokens + email verification
- **Image Storage**: Local filesystem with organized structure
- **Email**: SMTP (configurable)

### Frontend (Web)
- **Framework**: Next.js 14+ (App Router)
- **UI Framework**: shadcn/ui + Tailwind CSS
- **State**: React Query for server state
- **Forms**: React Hook Form + Zod validation

### Mobile (Android)
- **Language**: Kotlin
- **UI**: Jetpack Compose
- **Networking**: Retrofit + OkHttp
- **Camera**: CameraX

## Core Features

1. **User Management**
   - Email signup with confirmation
   - Login/logout with JWT
   - Password reset

2. **Collections**
   - Create named collections
   - Define custom metadata schema per collection
   - Metadata field types: text, number, date, timestamp, checkbox, select (with options)

3. **Items**
   - CRUD operations
   - Dynamic metadata based on collection schema
   - Multiple images per item
   - Search and filter

4. **Images**
   - Upload from web (drag & drop, file picker)
   - Upload from mobile app
   - Rotate and crop before saving
   - Organized storage: `uploads/{user_id}/{collection_id}/{item_id}/{filename}`
   - Thumbnail generation

5. **Mobile App**
   - Pair with logged-in web session via QR code or pairing code
   - Select collection to work with
   - Create new items with metadata
   - Camera integration for photos
   - Offline queue with sync

## Project Structure

```
antique-catalogue/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Config, security, deps
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── main.py
│   ├── tests/
│   ├── uploads/           # Image storage
│   ├── alembic/           # Migrations
│   └── pyproject.toml
├── frontend/
│   ├── app/               # Next.js app router
│   ├── components/
│   ├── lib/
│   └── package.json
├── mobile/
│   └── android/           # Kotlin/Compose app
└── docker-compose.yml     # Optional containerization
```

## Success Criteria

- [ ] User can sign up, confirm email, and log in
- [ ] User can create collections with custom metadata schemas
- [ ] User can add/edit/delete items with dynamic fields
- [ ] User can upload images from web with rotate/crop
- [ ] Android app can pair with web session
- [ ] Android app can capture photos and upload to server
- [ ] Image upload is verified (checksum or confirmation)
- [ ] **80% test coverage** across backend
- [ ] Responsive, modern UI
- [ ] Fast retrieval even with large datasets (indexed queries)
