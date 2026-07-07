# QFlow — Smart Virtual Queue & Appointment Management System

QFlow is a high-performance, real-time queue management system designed to reduce lobby congestion, digitize check-ins, and streamline customer flows. Built with a premium futuristic dark theme inspired by Linear and Vercel — featuring glassmorphism panels, Poppins/Inter typography, and Electric Blue/AI Purple gradients. Citizens can book appointments online, check in via QR code, track their live queue position, and hear audio alerts when their ticket is called.

---

## 🚀 Key Features

- **Auth Layer & RBAC**: Fully-featured JWT authentication with access/refresh token rotation for Citizens, Staff, and Admins.
- **Appointment Wizard**: Responsive 3-step scheduling system with dynamic office/service selection and calendar bookings.
- **Webcam QR Scanner**: In-browser camera scanner on the Staff Desk to instantly check in citizens upon arrival.
- **Real-time Broadcaster**: WebSockets stream ticket numbers, counter updates, and wait times instantly to all connected clients.
- **Public Lobby Display (Lobby TV)**: Lobby queue board featuring a flashing highlight display and automated Text-to-Speech audio notifications (e.g., *"Ticket A-101, please proceed to Counter 1"*).
- **Interactive Dashboards**:
  - **Citizen**: Bookings manager, QR code viewer, live estimated wait calculations, self check-in.
  - **Staff Desk**: Call next, start service, complete, skip (no-show), service timer, manual QR scanner.
  - **Admin Control**: Office CRUDs, services, counter allocations, holiday schedules, and analytics reports.
- **Background Mailer**: Asynchronous email dispatches on bookings, cancellations, check-ins, and counter calls.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework (component-based) |
| **Vite** | Build tool & dev server |
| **React Router v6** | Client-side routing & navigation |
| **Tailwind CSS v4** | Utility-first styling |
| **Lucide React** | Icon library |
| **JavaScript (JSX)** | Language — no TypeScript |

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.12** | Server-side language |
| **FastAPI** | REST API framework (async) |
| **SQLAlchemy** | ORM for database interaction |
| **Alembic** | Database migrations |
| **JWT** | Authentication & token management |
| **WebSockets** | Real-time live queue updates |
| **Uvicorn** | ASGI production server |

### Database & Deployment
| Technology | Purpose |
|---|---|
| **PostgreSQL** | Relational database |
| **Supabase** | Managed PostgreSQL hosting |
| **Vercel** | Frontend hosting |
| **Render** | Backend hosting |

---

## 📁 Project Directory Structure

```text
Q-Flow/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI routes (auth, offices, queue, etc.)
│   │   ├── core/            # Security (JWT), configurations, dependencies
│   │   ├── db/              # Session setup, database seeding script
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Business logic layers (appointments, queue)
│   │   ├── tests/           # Pytest integration tests
│   │   └── main.py          # FastAPI application entry point
│   ├── alembic/             # Database migration versions
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Production Python slim build
│   └── .env                 # Local environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Common UI (ProtectedRoute, CameraScanner)
│   │   ├── context/         # AuthContext (React Context API)
│   │   ├── hooks/           # Custom hooks (useAuth)
│   │   ├── pages/           # Admin, Staff, Citizen, & Lobby dashboards (JSX)
│   │   ├── services/        # Axios API handlers (JS)
│   │   └── types/           # Shared data shape definitions (JS)
│   ├── vercel.json          # SPA rewrite rules for Vercel deployment
│   ├── vite.config.js       # Vite build configuration
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   └── package.json         # npm dependencies (no TypeScript)
│
├── docs/                    # Architectural and deployment guides
└── README.md
```

---

## ⚙️ Configuration & Environment Setup

Create a `.env` file under `backend/.env` containing the following parameters:

```env
# Database Connections
DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SYNC_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# JWT Configurations (Generate secure keys)
JWT_SECRET_KEY=qflow_development_secret_access_jwt_key_32_bytes_long
JWT_REFRESH_SECRET_KEY=qflow_development_secret_refresh_jwt_key_32_bytes_long
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# SMTP Mail Server (Optional - Falls back to terminal logging if blank)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@qflow.com
```

Create a `.env` file under `frontend/.env` (or set in Vercel dashboard):

```env
VITE_API_URL=https://your-render-backend-url.onrender.com
VITE_WS_URL=wss://your-render-backend-url.onrender.com
```

---

## 💻 Local Setup & Development

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run Alembic migrations to construct database tables:
   ```bash
   $env:PYTHONPATH="."  # Windows PowerShell
   alembic upgrade head
   ```
5. Seed default demo data:
   ```bash
   python -m app.db.seed
   ```
6. Spin up the development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *FastAPI Swagger documentation will be available at:* [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite React client:
   ```bash
   npm run dev
   ```
   *Vite development server will be available at:* [http://localhost:5173/](http://localhost:5173/)

---

## 🧪 Testing Commands

### Backend Tests
Execute database unit and API endpoint tests:
```bash
cd backend
$env:PYTHONPATH="."
.\venv\Scripts\pytest app/tests/test_api.py
```

### Frontend Tests
Execute route guard and rendering tests:
```bash
cd frontend
npx vitest run
```

---

## ⚡ Vercel Deployment (Frontend)

The React + Vite frontend is fully optimized for Vercel. A [`vercel.json`](frontend/vercel.json) file is included to configure URL rewrites for Single Page Application (SPA) routing, preventing 404 errors on page reloads.

### Steps to Deploy Frontend on Vercel:
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New** > **Project** and import your QFlow GitHub repository.
3. Configure the following project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following **Environment Variables** in Vercel:
   - `VITE_API_URL` — The public HTTPS URL of your Render backend (e.g., `https://q-flow-api.onrender.com`)
   - `VITE_WS_URL` — The public WSS URL for WebSocket (e.g., `wss://q-flow-api.onrender.com`)
5. Click **Deploy**.

> [!NOTE]
> The **backend** (FastAPI with WebSockets) must be hosted on a persistent server platform like **Render**, Railway, Fly.io, or AWS EC2. Vercel's serverless functions do **not** support persistent WebSocket connections.

---

## 🚂 Render Deployment (Backend)

### Steps to Deploy Backend on Render:
1. Go to [Render Dashboard](https://dashboard.render.com) and click **New Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Add all required environment variables from your `.env` file.
5. Click **Create Web Service**.

---

## 🗄️ Supabase Database Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Copy your **Database URL** from Project Settings → Database.
3. Paste into `backend/.env` as `DATABASE_URL` and `SYNC_DATABASE_URL`.
4. Run migrations: `alembic upgrade head`
5. Run seed: `python -m app.db.seed`

---

## 🏗️ System Architecture

```
┌─────────────────┐       HTTPS / REST       ┌─────────────────┐
│  React + Vite   │ ──────────────────────── │   FastAPI       │
│  (Vercel)       │       WebSocket (WSS)    │   (Render)      │
└─────────────────┘ ──────────────────────── └────────┬────────┘
                                                       │ SQLAlchemy (asyncpg)
                                               ┌───────▼────────┐
                                               │  PostgreSQL    │
                                               │  (Supabase)    │
                                               └────────────────┘
```

---

## 🔑 Pre-seeded Login Credentials (Password: `password123`)

| Role | Email | Access |
|---|---|---|
| **Administrator** | `admin@qflow.com` | Full CRUD access to all system settings |
| **Staff Clerk** | `staff@qflow.com` | Counter assignment, serving queue |
| **Citizen User** | `citizen@qflow.com` | Appointments, QR check-in, queue tracking |
