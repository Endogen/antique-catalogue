# AGENTS.md

## Project
Antique Catalogue — A responsive web platform for cataloguing antique items with custom metadata schemas and images.

## Tech Stack
- **Backend**: Python 3.12, FastAPI, SQLite, SQLAlchemy, Alembic
- **Frontend**: Next.js 14+, shadcn/ui, Tailwind CSS, React Query
- **Images**: Pillow for processing, disk storage
- **Email**: SMTP via environment variables

## Project Structure
```
antique-catalogue/
├── backend/           # FastAPI application
├── frontend/          # Next.js application
├── specs/             # Requirements specifications
└── docker-compose.yml
```

## Commands

### Backend
- **Activate venv**: `source backend/.venv/bin/activate`
- **Install**: `cd backend && pip install -e ".[dev]"`
- **Run**: `cd backend && .venv/bin/uvicorn app.main:app --reload`
- **Test**: `cd backend && .venv/bin/pytest --timeout=30 --cov=app --cov-report=term-missing`
- **Lint**: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`
- **Format**: `cd backend && .venv/bin/ruff format .`
- **Migrate**: `cd backend && .venv/bin/alembic upgrade head`

### Frontend
- **Install**: `cd frontend && npm install`
- **Run**: `cd frontend && npm run dev`
- **Build**: `cd frontend && npm run build`
- **Test**: `cd frontend && npm test`
- **Lint**: `cd frontend && npm run lint`

## Backpressure
Run after each implementation:
1. `cd backend && .venv/bin/ruff check . --fix && .venv/bin/ruff format .`
2. `cd backend && .venv/bin/pytest --timeout=30`

## Completion Criteria
- All tests pass
- ~80% backend test coverage
- No lint errors
- All API endpoints functional
- Frontend builds without errors
- Responsive design works on mobile

## Human Decisions
<!-- Decisions made by humans are recorded here -->

## Learnings
- Virtual environment at `backend/.venv` has all dependencies installed.
- Verification emails are skipped (logged) when `SMTP_HOST` or `SMTP_FROM` is unset.
