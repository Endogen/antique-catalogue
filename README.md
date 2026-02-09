# Antique Catalogue

A responsive web platform for cataloguing antique items with custom metadata schemas, image management, and public collection sharing.

## Features

- **Custom Metadata Schemas**: Define per-collection fields (text, number, date, select, etc.)
- **Image Management**: Upload, resize, and organize item photos from desktop or mobile
- **Camera Capture**: Take photos directly from your browser on mobile devices
- **Public Collections**: Share curated collections publicly while keeping others private
- **User Authentication**: Email verification, password reset, JWT-based sessions
- **Search & Filter**: Full-text search with filtering and sorting across items

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Next.js        │────▶│  FastAPI        │
│  Frontend       │     │  Backend        │
│  (Port 3000)    │     │  (Port 8000)    │
│                 │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │                 │
                        │  SQLite DB      │
                        │  + File Storage │
                        │                 │
                        └─────────────────┘
```

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM with async support
- **Alembic** - Database migrations
- **Pillow** - Image processing (resize, convert to JPG)
- **SQLite** - Database (easily swappable to PostgreSQL)

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **React Query** - Server state management
- **React Hook Form** - Form handling with Zod validation

## Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) Node.js 20+ and Python 3.12+ for local development

### Production Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/Endogen/antique-catalogue.git
   cd antique-catalogue
   ```

2. Configure environment (optional):
   ```bash
   # Create .env file for sensitive values
   cat > .env << 'EOF'
   JWT_SECRET=your-secure-random-secret
   SMTP_HOST=mail.example.com
   SMTP_PORT=587
   SMTP_USER=noreply@example.com
   SMTP_PASSWORD=your-smtp-password
   SMTP_FROM=noreply@example.com
   EOF
   ```

3. Start with Docker Compose:
   ```bash
   docker compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:3010
   - Backend API: http://localhost:8000
   - Health check: http://localhost:8000/health

### Nginx Reverse Proxy (Production)

Example nginx configuration for a domain:

```nginx
server {
    listen 80;
    server_name antique.example.com;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Then enable SSL with certbot:
```bash
sudo certbot --nginx -d antique.example.com
```

## Local Development

### Backend

```bash
cd backend

# Create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set API URL for local development
export NEXT_PUBLIC_API_URL=http://localhost:8000

# Start development server
npm run dev
```

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/verify` - Verify email
- `POST /auth/login` - Get access token
- `POST /auth/refresh` - Refresh token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `GET /auth/me` - Get current user
- `DELETE /auth/me` - Delete account

### Collections
- `GET /collections` - List user's collections
- `POST /collections` - Create collection
- `GET /collections/{id}` - Get collection
- `PUT /collections/{id}` - Update collection
- `DELETE /collections/{id}` - Delete collection
- `GET /public/collections` - List public collections

### Schema (Field Definitions)
- `GET /collections/{id}/fields` - List fields
- `POST /collections/{id}/fields` - Create field
- `PUT /collections/{id}/fields/{field_id}` - Update field
- `DELETE /collections/{id}/fields/{field_id}` - Delete field
- `POST /collections/{id}/fields/reorder` - Reorder fields

### Items
- `GET /collections/{id}/items` - List items (with search/filter/sort)
- `POST /collections/{id}/items` - Create item
- `GET /collections/{id}/items/{item_id}` - Get item
- `PUT /collections/{id}/items/{item_id}` - Update item
- `DELETE /collections/{id}/items/{item_id}` - Delete item

### Images
- `GET /items/{item_id}/images` - List images
- `POST /items/{item_id}/images` - Upload image
- `DELETE /items/{item_id}/images/{image_id}` - Delete image
- `POST /items/{item_id}/images/reorder` - Reorder images
- `GET /images/{image_id}/{variant}` - Serve image (original/medium/thumb)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/antique_catalogue.db` | Database connection string |
| `UPLOADS_PATH` | `./uploads` | Path for uploaded images |
| `JWT_SECRET` | `change-me` | Secret for JWT signing (change in production!) |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token expiry |
| `AUTO_VERIFY_EMAIL` | `false` | Auto-verify accounts on registration (useful for local/dev) |
| `REFRESH_TOKEN_COOKIE_PATH` | `/` | Path scope for the refresh token cookie |
| `ADMIN_EMAIL` | - | Admin login email for /admin |
| `ADMIN_PASSWORD` | - | Admin login password for /admin |
| `ADMIN_TOKEN_EXPIRE_MINUTES` | `60` | Admin token expiry |
| `SMTP_HOST` | - | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASSWORD` | - | SMTP password |
| `SMTP_FROM` | - | From address for emails |
| `SMTP_USE_TLS` | `true` | Use STARTTLS |

Note: When `DATABASE_URL` is not set and SQLite is used, the backend resolves
relative SQLite paths against the backend directory (not the current working
directory). The default database file lives at `backend/data/antique_catalogue.db`
in this repository.

## Testing

### Backend Tests

```bash
cd backend
source .venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_auth.py -v
```

### Test Coverage

The backend maintains ~80% test coverage with:
- Unit tests for services (auth, email, image processing)
- Integration tests for all API endpoints
- E2E smoke test covering the full user flow

## Project Structure

```
antique-catalogue/
├── backend/
│   ├── app/
│   │   ├── api/           # Route handlers
│   │   ├── core/          # Settings, security
│   │   ├── db/            # Database setup
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── alembic/           # Database migrations
│   ├── tests/             # Backend tests
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── lib/               # API client, utilities
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## License

MIT

## Credits

Built with [Codex](https://github.com/openai/codex) using the [Ralph Loop](https://github.com/Endogen/ralph-loop) pattern.
