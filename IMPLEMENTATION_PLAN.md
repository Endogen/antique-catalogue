STATUS: READY

# Implementation Plan

## Phase 1: Backend Setup
- [ ] 1.1: Initialize backend project (FastAPI, SQLAlchemy, Alembic, pyproject.toml)
- [ ] 1.2: Configure settings (env vars: DB, JWT secret, SMTP, uploads path)
- [ ] 1.3: Set up SQLAlchemy models base and database session
- [ ] 1.4: Implement password hashing and JWT utilities
- [ ] 1.5: Add global exception handling and API response schemas

## Phase 2: Backend Auth
- [ ] 2.1: Create User and EmailToken models with migrations
- [ ] 2.2: Implement register endpoint with email verification token
- [ ] 2.3: Implement verify email endpoint
- [ ] 2.4: Implement login/logout/refresh endpoints
- [ ] 2.5: Implement forgot/reset password endpoints
- [ ] 2.6: Implement /auth/me and DELETE /auth/me (account deletion)
- [ ] 2.7: Add auth tests (unit + integration)

## Phase 3: Backend Collections
- [ ] 3.1: Create Collection model with migrations
- [ ] 3.2: Implement collection CRUD endpoints
- [ ] 3.3: Implement public collections endpoints (no auth)
- [ ] 3.4: Add collection tests

## Phase 4: Backend Schema
- [ ] 4.1: Create FieldDefinition model with migrations
- [ ] 4.2: Implement field CRUD endpoints
- [ ] 4.3: Implement field reorder endpoint
- [ ] 4.4: Add schema tests

## Phase 5: Backend Items
- [ ] 5.1: Create Item model with migrations
- [ ] 5.2: Implement metadata validation service
- [ ] 5.3: Implement item CRUD endpoints
- [ ] 5.4: Implement item list with search/filter/sort/pagination
- [ ] 5.5: Add item tests

## Phase 6: Backend Images
- [ ] 6.1: Create ItemImage model with migrations
- [ ] 6.2: Implement image processing service (resize, convert to JPG)
- [ ] 6.3: Implement image upload endpoint
- [ ] 6.4: Implement image list/delete/reorder endpoints
- [ ] 6.5: Implement image serving endpoint
- [ ] 6.6: Add image tests

## Phase 7: Frontend Setup
- [ ] 7.1: Initialize Next.js app with Tailwind and shadcn/ui
- [ ] 7.2: Set up API client with auth handling
- [ ] 7.3: Build layout (header, sidebar, responsive shell)
- [ ] 7.4: Implement auth context and route guards

## Phase 8: Frontend Auth
- [ ] 8.1: Build login and register pages
- [ ] 8.2: Build email verification page
- [ ] 8.3: Build forgot/reset password pages
- [ ] 8.4: Build user settings page

## Phase 9: Frontend Collections
- [ ] 9.1: Build collections list page
- [ ] 9.2: Build collection create/edit forms
- [ ] 9.3: Build schema builder component
- [ ] 9.4: Build public collections explorer

## Phase 10: Frontend Items
- [ ] 10.1: Build items list with search/filter/sort
- [ ] 10.2: Build dynamic item form (from schema)
- [ ] 10.3: Build item detail page

## Phase 11: Frontend Images
- [ ] 11.1: Build image uploader (drag-drop + camera capture)
- [ ] 11.2: Build image gallery with reorder
- [ ] 11.3: Build image delete flow

## Phase 12: Docker & Polish
- [ ] 12.1: Create Dockerfile for backend
- [ ] 12.2: Create Dockerfile for frontend
- [ ] 12.3: Create docker-compose.yml
- [ ] 12.4: Verify 80% backend test coverage
- [ ] 12.5: Final E2E smoke test
