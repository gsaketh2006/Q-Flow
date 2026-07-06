# QFlow — Smart Virtual Queue & Appointment Management System

QFlow is a high-performance queue management system designed to reduce lobby congestion, digitize check-ins, and streamline customer flows. Citizens can book appointments online, check in via QR code using their webcam, track their live queue position, and hear audio alerts when their ticket is called.

---

## 🚀 Key Features

- **Auth Layer & RBAC**: Fully-featured JWT authentication with access/refresh token rotation for Citizens, Staff, and Admins.
- **Appointment Wizard**: Responsive scheduling system with dynamic slot conflicts and calendar bookings.
- **Webcam QR Scanner**: In-browser camera scanner on the Staff Desk to instantly check in citizens upon arrival.
- **Real-time Broadcaster**: WebSockets stream ticket numbers, server counters, and wait times instantly.
- **Public Lobby Display (Lobby TV)**: Lobby queue board featuring a flashing highlight board and automated Text-to-Speech audio notifications (e.g., *"Ticket A-101, please proceed to Counter 1"*).
- **Interactive Dashboards**:
  - **Citizen**: Bookings manager, live estimated wait calculations.
  - **Staff Desk**: Serve next, complete, skip, timer counters.
  - **Admin Control**: Office CRUDs, services, counter allocations, and staff leaderboards.
- **Background Mailer**: Asynchronous email dispatches on bookings, cancellations, check-ins, and counter calls.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy, Asyncpg, Alembic migrations, Pytest.
- **Frontend**: React 19 (TypeScript), Vite, Tailwind CSS v4, Lucide-icons, Vitest.
- **Database**: Supabase PostgreSQL.
- **Real-Time**: Native Python Websockets.
- **Deployment**: Docker, Docker Compose, Nginx.

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
│   ├── Dockerfile           # Production Python slim build
│   └── .env                 # Local environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Common UI (Protected Routes, Camera Scanner)
│   │   ├── context/         # Auth states
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Admin, Staff, Citizen, & Lobby dashboards
│   │   ├── services/        # Axios API handlers
│   │   └── tests/           # Vitest frontend tests
│   ├── Dockerfile           # Production Node + Nginx build
│   ├── nginx.conf           # Reverse proxy gateway configuration
│   └── package.json
│
├── docs/                    # Architectural and deployment guides
├── docker-compose.prod.yml  # Multi-container production gateway orchestration
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
   cd ../frontend
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

## ⚡ Vercel Deployment (Frontend Only)

The React frontend Vite app is fully optimized for Vercel. A [`vercel.json`](file:///e:/Q-Flow/frontend/vercel.json) file is included to configure URL rewrites for Single Page Application (SPA) routing, preventing 404 errors on page reloads.

### Steps to Deploy Frontend on Vercel:
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New** > **Project** and import your QFlow repository.
3. Configure the following project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following **Environment Variables** in Vercel:
   - `VITE_API_URL`: The public HTTPS URL of your deployed FastAPI backend (e.g., `https://api.yourdomain.com`).
   - `VITE_WS_URL`: The public WSS URL of your deployed FastAPI backend WebSocket endpoint (e.g., `wss://api.yourdomain.com`).
5. Click **Deploy**.

> [!NOTE]
> The **backend** (FastAPI with WebSockets) must be hosted on a persistent server platform (like Render, Railway, Fly.io, or AWS EC2) since Vercel's serverless functions do not support persistent TCP/WebSocket connections.

---

## 🐳 Production Deployment (Docker Compose)

The production configuration bundles the frontend React app compiled inside an Alpine Nginx image, proxying REST API calls `/api` and WebSocket handshakes `/ws` dynamically to the backend container.

1. Ensure Docker is running.
2. Build and spin up the containerized network:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```
3. The application will be serving at your server's public gateway: [http://localhost](http://localhost)

---

## 🔑 Pre-seeded Login Credentials (Password: `password123`)

- **Administrator**: `admin@qflow.com` (full CRUD access to system parameters)
- **Staff Clerk**: `staff@qflow.com` (assigned to counter, serves waitlists)
- **Citizen User**: `citizen@qflow.com` (schedules appointments, gets queue tickets)
