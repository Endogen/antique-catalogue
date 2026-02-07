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
- **Install**: `cd backend && pip install -e ".[dev]"`
- **Run**: `cd backend && uvicorn app.main:app --reload`
- **Test**: `cd backend && pytest --cov=app --cov-report=term-missing`
- **Lint**: `cd backend && ruff check . && ruff format --check .`
- **Format**: `cd backend && ruff format .`
- **Migrate**: `cd backend && alembic upgrade head`

### Frontend
- **Install**: `cd frontend && npm install`
- **Run**: `cd frontend && npm run dev`
- **Build**: `cd frontend && npm run build`
- **Test**: `cd frontend && npm test`
- **Lint**: `cd frontend && npm run lint`

## Backpressure
Run after each implementation:
1. `cd backend && ruff check . --fix && ruff format .`
2. `cd backend && pytest`

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
<!-- Agent appends operational notes here -->
