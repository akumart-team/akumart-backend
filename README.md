# AkuMart Backend API

> B2B Waste-to-Resource Marketplace — FastAPI backend powering the AkuMart platform.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Database Migrations](#database-migrations)
- [API Reference](#api-reference)
- [Code Quality & CI](#code-quality--ci)
- [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [FastAPI](https://fastapi.tiangolo.com/) |
| Language | Python 3.12 |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (via Supabase) |
| Migrations | Alembic |
| Auth | JWT (PyJWT) — access + refresh token pair |
| Email | [Resend](https://resend.com/) |
| Cache / OTP | Redis |
| Package Manager | [uv](https://docs.astral.sh/uv/) |
| Linting | Flake8 + Ruff |
| Type Checking | mypy |
| Deployment | Vercel (serverless) |

---

## Project Structure

```
akumart-backend/
├── app/
│   ├── main.py               # FastAPI application entry point
│   ├── api/
│   │   ├── deps/             # Shared FastAPI dependencies (auth, DB session)
│   │   └── routers/
│   │       └── auth.py       # Authentication & profile routes
│   ├── core/
│   │   ├── config.py         # Pydantic settings (reads from .env)
│   │   ├── database.py       # Async SQLAlchemy engine & session
│   │   ├── email.py          # Resend email helpers
│   │   ├── otp.py            # OTP generation & Redis storage
│   │   └── security.py       # JWT creation, hashing, verification
│   ├── models/               # SQLAlchemy ORM models
│   ├── schemas/              # Pydantic request/response schemas
│   └── services/             # Business logic layer
│       ├── auth.py
│       └── profile.py
├── alembic/                  # Database migration scripts
├── alembic.ini
├── pyproject.toml            # Project metadata & dependencies
├── setup.cfg                 # Flake8 configuration
├── uv.lock                   # Locked dependency versions
└── vercel.json               # Vercel deployment config
```

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.12** — [Download](https://www.python.org/downloads/)
- **uv** (package manager) — [Install](https://docs.astral.sh/uv/getting-started/installation/)
- **Redis** — Required for OTP rate limiting. [Install](https://redis.io/docs/install/install-redis/) or use a managed service
- **PostgreSQL** — Provided via Supabase (no local install needed for dev)

### Installing uv

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Local Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd akumart-backend
```

### 2. Create and activate the virtual environment

```bash
uv sync
```

This command will:
- Create a `.venv` using Python 3.12
- Install all exact dependency versions from `uv.lock`

### 3. Configure environment variables

```bash
cp .env.example .env   # or create .env manually (see section below)
```

Fill in the required values in `.env`.

### 4. Dependency Management

This project manages dependencies using `pyproject.toml` and `uv.lock`. 

When adding, removing, or updating dependencies, use `uv` directly:

```bash
# Add a new dependency
uv add <dependency_name>

# Install/sync dependencies after changes
uv sync
```

---

## Environment Variables

Create a `.env` file in the project root. All variables are listed below:

```env
# ── Database ────────────────────────────────────────────────
# Async PostgreSQL DSN (Supabase connection string)
# Format: postgresql+asyncpg://user:password@host:port/dbname
DATABASE_URL=""

# ── Authentication ──────────────────────────────────────────
# Long random secret used to sign JWTs — keep this private!
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=""

# ── Email (Resend) ──────────────────────────────────────────
# Get your API key from https://resend.com/api-keys
RESEND_API_KEY=""
MAIL_FROM="onboarding@resend.dev"
MAIL_FROM_NAME="AkuMart"

# ── Redis ───────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379/0"

# ── Optional ────────────────────────────────────────────────
DEBUG=false
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Cloudinary (for media uploads — leave blank if not used yet)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

> **Never commit your `.env` file.** It is listed in `.gitignore`.

---

## Running the Application

### Development server (with auto-reload)

```bash
uv run uvicorn app.main:app --reload
```

The API will be available at:

| Endpoint | URL |
|---|---|
| API base | http://127.0.0.1:8000 |
| Health check | http://127.0.0.1:8000/health |
| Interactive docs (Swagger) | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |

### Custom host/port

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

---

## Database Migrations

This project uses **Alembic** for database schema migrations.

### Apply all pending migrations

```bash
uv run alembic upgrade head
```

### Create a new migration (after changing models)

```bash
uv run alembic revision --autogenerate -m "describe your change here"
```

### Rollback the last migration

```bash
uv run alembic downgrade -1
```

---

## API Reference

All routes are prefixed with `/api/v1`.

### Authentication — `/api/v1/auth`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/register` | Create a new account, sends OTP to email | No |
| `POST` | `/auth/verify-otp` | Verify email with OTP code, returns token pair | No |
| `POST` | `/auth/resend-otp` | Resend OTP (rate limited: 3/hour) | No |
| `POST` | `/auth/login` | Authenticate with email & password | No |
| `POST` | `/auth/refresh` | Rotate access + refresh token pair | No |
| `POST` | `/auth/logout` | Invalidate refresh token | No |
| `POST` | `/auth/select-role` | Select buyer or seller role after verification | Yes |
| `POST` | `/auth/switch-role` | Switch between buyer and seller roles | Yes |
| `GET` | `/auth/me` | Get current authenticated user's profile | Yes |
| `PATCH` | `/auth/me/seller_profile` | Create/update seller profile | Yes (seller) |
| `PATCH` | `/auth/me/buyer_profile` | Create/update buyer profile | Yes (buyer) |
| `GET` | `/auth/me/seller_profile` | Get seller profile | Yes |
| `GET` | `/auth/me/buyer_profile` | Get buyer profile | Yes |

### General

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{"status": "ok"}` |

### Authentication Flow

```
POST /register
  └─→ POST /verify-otp    (activate account, get token pair)
        └─→ POST /select-role  (choose buyer or seller, get role-embedded tokens)
              └─→ PATCH /me/{role}_profile  (complete profile setup)
```

---

## Code Quality & CI

### Run locally

```bash
# Lint
uv run flake8 app/

# Type check
uv run mypy app/ --ignore-missing-imports --explicit-package-bases --pretty

# Format check (Ruff)
uv run ruff check app/
uv run ruff format --check app/
```

### CI Pipeline (GitHub Actions)

Every push and pull request runs:

| Job | Tool | What it checks |
|---|---|---|
| Python Type Check | mypy | Type correctness across all 20 source files |
| Python Lint | Flake8 | Style errors (E302, E251, W291, etc.) |
| Vulnerability Scan | Trivy | Known CVEs in OS packages and Python deps |

---

## Deployment

The application is configured for **Vercel** serverless deployment via `vercel.json`.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

> Set all environment variables in the Vercel project dashboard under **Settings → Environment Variables** before deploying.

---

## Contributing

1. Create a feature branch from `dev`: `git checkout -b feature/your-feature`
2. Make your changes
3. Ensure lint and type checks pass locally before pushing
4. Open a pull request into `dev`