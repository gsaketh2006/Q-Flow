# QFlow Production Deployment Guide

This guide details how to build, run, and maintain the QFlow system in a production environment using Docker and Docker Compose.

## 1. Prerequisites
Ensure you have the following installed on your host system:
- **Docker** (Engine 20.10+)
- **Docker Compose** (V2+)

---

## 2. Configuration & Environment Setup
Before deployment, configure your environment variables. You should override default credentials with secure production equivalents.

| Variable Name | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | Async PG connection URI | `postgresql+asyncpg://postgres:secure_pwd@db:5432/qflow` |
| `SYNC_DATABASE_URL` | Sync PG connection URI (for Alembic migrations) | `postgresql://postgres:secure_pwd@db:5432/qflow` |
| `JWT_SECRET_KEY` | Hex token key for signing JWT tokens | Generate via `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET_KEY` | Hex token key for refresh tokens | Generate via `openssl rand -hex 32` |
| `SMTP_HOST` | Host address of SMTP relay | `smtp.sendgrid.net` |
| `SMTP_PORT` | Port of SMTP relay | `587` (STARTTLS) or `465` (SSL) |
| `SMTP_USER` | Login email / username | `apikey` |
| `SMTP_PASSWORD` | Access password / API key | `production_app_key` |
| `SMTP_FROM_EMAIL` | Sender address | `noreply@qflow.com` |

---

## 3. Deployment Steps

### Step A: Build & Boot Containers
Spin up the database, API backend, and static web Nginx server in detached mode:
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Step B: Run Database Migrations
Run Alembic migrations inside the running backend container to generate tables:
```bash
docker exec -it qflow_prod_backend alembic upgrade head
```

### Step C: Seed Default Production Data
Seed roles (citizen, staff, admin) and initial admin credentials into the database:
```bash
docker exec -it qflow_prod_backend python -m app.db.seed
```
*Note: The seeding script creates a default Administrator account:*
- **Email**: `admin@qflow.com`
- **Password**: `AdminPassword123`
*(Make sure to log in immediately and update your password in the profile settings.)*

---

## 4. Port Allocations & Reverse Proxying
- **Frontend App**: Listens on Port `80` (HTTP) of the host.
- **Nginx Config**: Serves static React components, proxies `/api` requests to `qflow_prod_backend:8000`, and handles upgrading `/ws` connections for real-time queue boards.

To add SSL (HTTPS), configure a reverse proxy (like Nginx, Caddy, or Traefik) on the host machine to bind Port `443` and route traffic to Port `80`.
