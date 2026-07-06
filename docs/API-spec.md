# QFlow — API Specification

This document details the REST API specification for QFlow. The backend routers are organized under `backend/app/api/v1/` with one file per resource.

---

## 1. Authentication Router (`auth.py`)

Handles user onboarding, authentication, JWT tokens, and password recovery.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | No | Public | Register a new Citizen account. |
| `POST` | `/api/v1/auth/login` | No | Public | Login with email and password. Returns a short-lived Access JWT in response body and sets a secure, HTTP-only Refresh JWT cookie. |
| `POST` | `/api/v1/auth/refresh` | No | Public | Rotate/refresh the Access JWT using the HTTP-only Refresh JWT cookie. |
| `POST` | `/api/v1/auth/logout` | Yes | Citizen/Staff/Admin | Invalidate current refresh token and clear cookies. |
| `POST` | `/api/v1/auth/forgot-password` | No | Public | Send a password reset token via email. |
| `POST` | `/api/v1/auth/reset-password` | No | Public | Consume reset token and set a new password. |

---

## 2. Users Router (`users.py`)

Handles user profile retrieval, updates, and administrative management.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Yes | Citizen/Staff/Admin | Retrieve the authenticated user's profile information. |
| `PUT` | `/api/v1/users/me` | Yes | Citizen/Staff/Admin | Update profile fields: `full_name`, `phone`, `language_pref`. |
| `GET` | `/api/v1/users` | Yes | Admin | List all users (with filters for role, status, search, and pagination). |
| `GET` | `/api/v1/users/{id}` | Yes | Staff/Admin | Get details of a specific user. |
| `PUT` | `/api/v1/users/{id}` | Yes | Admin | Update user role, status, or details. |
| `DELETE` | `/api/v1/users/{id}` | Yes | Admin | Deactivate/soft-delete a user. |

---

## 3. Offices Router (`offices.py`)

Handles offices, counters, and office holidays.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/offices` | No | Public | List all active offices (supports pagination and filter by `city` or name keyword). |
| `GET` | `/api/v1/offices/{id}` | No | Public | Get detailed office info, including active services and counters. |
| `POST` | `/api/v1/offices` | Yes | Admin | Create a new office. |
| `PUT` | `/api/v1/offices/{id}` | Yes | Admin | Update office details (working hours, location, name, status). |
| `DELETE` | `/api/v1/offices/{id}` | Yes | Admin | Deactivate an office. |
| `GET` | `/api/v1/offices/{id}/counters` | Yes | Staff/Admin | List all counters at this office. |
| `POST` | `/api/v1/offices/{id}/counters` | Yes | Admin | Add a counter to this office. |
| `PUT` | `/api/v1/offices/{id}/counters/{counter_id}` | Yes | Admin | Assign staff to counter or update counter name/status. |
| `DELETE` | `/api/v1/offices/{id}/counters/{counter_id}` | Yes | Admin | Remove counter. |
| `GET` | `/api/v1/offices/{id}/holidays` | No | Public | List upcoming holidays for the office. |
| `POST` | `/api/v1/offices/{id}/holidays` | Yes | Admin | Add a holiday (closing the office for that date). |
| `DELETE` | `/api/v1/offices/{id}/holidays/{holiday_id}` | Yes | Admin | Delete a holiday. |

---

## 4. Services Router (`services.py`)

Handles services offered by different offices.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/services` | No | Public | List all services (supports filtering by `office_id` and status). |
| `GET` | `/api/v1/services/{id}` | No | Public | Get service details. |
| `POST` | `/api/v1/services` | Yes | Admin | Create a service for an office. |
| `PUT` | `/api/v1/services/{id}` | Yes | Admin | Update service details (e.g. `avg_duration_minutes`). |
| `DELETE` | `/api/v1/services/{id}` | Yes | Admin | Deactivate/delete a service. |

---

## 5. Appointments Router (`appointments.py`)

Handles scheduling, cancellation, and validation of appointments.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/appointments` | Yes | Citizen/Staff/Admin | List appointments. Citizens see only their own. Staff/Admin see all (can filter by office, date, status). |
| `GET` | `/api/v1/appointments/{id}` | Yes | Citizen/Staff/Admin | Retrieve appointment details. Citizens can only view their own. |
| `POST` | `/api/v1/appointments` | Yes | Citizen/Staff/Admin | Book an appointment. Staff/Admin can book on behalf of a citizen. |
| `PUT` | `/api/v1/appointments/{id}/cancel` | Yes | Citizen/Staff/Admin | Cancel an appointment. Citizens can only cancel their own. |
| `PUT` | `/api/v1/appointments/{id}/check-in` | Yes | Citizen/Staff/Admin | Check in for an appointment. Requires verification token (either scanned QR code or staff confirmation). Moves status to `checked_in` and enqueues the ticket. |
| `GET` | `/api/v1/appointments/{id}/qr` | Yes | Citizen/Staff/Admin | Get the signed, secure QR token for checking in. |

---

## 6. Queue Router (`queue.py`)

Handles live queue listings, calling tickets, and serving customers.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/queue/live` | No | Public | Get anonymized, real-time queue listings for a specific office. Suitable for public displays and dashboard widgets. |
| `GET` | `/api/v1/queue/active` | Yes | Staff/Admin | List active, pending, and processing queue entries for the staff's assigned office. |
| `POST` | `/api/v1/queue/call-next` | Yes | Staff | Call the next waiting citizen for a service. Updates status to `called`, records `called_at`, links to the calling staff's counter, and publishes real-time WebSocket update. |
| `POST` | `/api/v1/queue/{id}/start-service` | Yes | Staff | Mark ticket as `in_progress` once the citizen reaches the counter. |
| `POST` | `/api/v1/queue/{id}/complete` | Yes | Staff | Mark ticket as `completed` when the citizen's service is finished. |
| `POST` | `/api/v1/queue/{id}/skip` | Yes | Staff | Mark ticket as `skipped` (no-show) if citizen does not respond. |
| `POST` | `/api/v1/queue/reorder` | Yes | Admin | Manually override queue positions. |

---

## 7. Notifications Router (`notifications.py`)

Handles notification logs and administrative resends.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Yes | Citizen/Admin | View list of notifications. Citizens see only their own. |
| `GET` | `/api/v1/notifications/{id}` | Yes | Citizen/Admin | Retrieve specific notification details. |
| `POST` | `/api/v1/notifications/resend/{id}` | Yes | Staff/Admin | Manually trigger a resend for a failed notification. |

---

## 8. Reports Router (`reports.py`)

Handles generation of analytical reports and performance tracking.

| Method | Path | Auth Required | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/summary` | Yes | Admin | Retrieve system-wide queue performance analytics. |
| `GET` | `/api/v1/reports/office/{id}` | Yes | Staff/Admin | Retrieve performance analytics for a specific office. |
| `GET` | `/api/v1/reports/staff/{id}` | Yes | Admin/Staff | Retrieve performance analytics for a specific staff member (or self). |

---

## 9. WebSockets Context

Real-time updates are pushed to clients via WebSockets.

- **WebSocket Route**: `/api/v1/ws/queue/{office_id}` (Public)
  - Connect to listen for real-time broadcasts.
  - Pushes event payloads on actions like ticket called, queue updated, estimated wait time recalculated.
