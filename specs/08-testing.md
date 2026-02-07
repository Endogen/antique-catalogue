# Testing

## Goal
~80% test coverage across frontend + backend combined.

## Backend Tests

### Unit Tests
- Validators (email, password strength)
- Metadata validation service
- Image processing utilities
- JWT utilities

### Integration Tests
- Auth flows (register, verify, login, reset)
- Collection CRUD + visibility
- Schema field CRUD
- Item CRUD + search/filter/sort
- Image upload + processing
- Cascade deletes

### API Tests
- All endpoints with valid/invalid inputs
- Permission checks (owner vs public)
- Error responses

## Frontend Tests

### Component Tests
- Form components
- Schema builder
- Image uploader
- Dynamic metadata form

### Page Tests
- Auth pages
- Collection list/detail
- Item list/detail/edit

## E2E Tests (Critical Flows)
1. Sign up → verify email → login
2. Create collection → define schema → create item
3. Upload image (file + camera capture simulation)
4. Make collection public → view as anonymous
5. Password reset flow
6. Account deletion

## Tools
- Backend: pytest, pytest-cov, httpx
- Frontend: Vitest, Testing Library, Playwright
