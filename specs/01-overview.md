# Overview

## Goal
Modern, responsive web platform for cataloguing antique items organized into user-defined collections with customizable metadata fields.

## Key Requirements
- Works well on Android phones (responsive design)
- Browser-based photo capture (no native app)
- Public/private collection visibility
- ~80% test coverage

## Tech Stack
- **Backend**: Python 3.12, FastAPI, SQLite, SQLAlchemy
- **Frontend**: Next.js 14+, shadcn/ui, Tailwind CSS
- **Images**: Stored on disk (not in DB), converted to JPG
- **Email**: SMTP (configured via environment variables)
- **Deployment**: Docker

## Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Next.js       │────▶│  FastAPI        │────▶│   SQLite     │
│   (Frontend)    │     │  (Backend)      │     │   (Database) │
└─────────────────┘     └─────────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Disk Storage │
                        │  (Images)     │
                        └──────────────┘
```
