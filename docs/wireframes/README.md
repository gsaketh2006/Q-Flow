# QFlow — Text-Based Wireframe Descriptions

This document outlines the visual structure, layout, user interactions, and interface states for the eight core screens of the QFlow application.

---

## 1. Login / Register Screen

* **Purpose**: User onboarding and authentication for Citizens, Staff, and Admins.
* **Layout**:
  - **Left Panel (60% width on Desktop, hidden on Mobile)**: A rich, animated visual representation of a modern queue (e.g., "Smart queuing made simple" text, background gradient, live-updating mock queue ticket ticker showing simulated progress).
  - **Right Panel (40% width on Desktop, 100% on Mobile)**: 
    - **Header**: QFlow Logo and Language selector dropdown (English, Spanish, etc.) in the top right.
    - **Toggle Tabs**: "Login" and "Register" pill-tabs.
    - **Form Area**:
      - *Login Form*: Email input, Password input, "Forgot Password?" text link, and "Remember Me" checkbox.
      - *Register Form*: Full Name input, Email input, Phone Number input, Language Preference dropdown, Password input, and Confirm Password input.
    - **Submit Button**: High-visibility primary button ("Sign In" or "Create Account").
* **States**:
  - **Default (Login)**: Displays login inputs.
  - **Default (Register)**: Displays registration inputs.
  - **Loading**: Primary button changes to a spinner, inputs are disabled to prevent double-submission.
  - **Error State**: Red toast notification or inline red helper text (e.g., "Invalid credentials", "Passwords do not match").
  - **Forgot Password Mode**: Replaces the form with an "Email Address" input and "Send Reset Link" button.

---

## 2. Citizen Dashboard

* **Purpose**: Portal for Citizens to book and manage appointments, check in, and view their real-time queuing status.
* **Layout**:
  - **Header**: Logo, navigation links (Dashboard, Bookings, Profile), language selector, and Profile Dropdown (Logout, Settings).
  - **Hero Section**: Greeting card ("Welcome back, [Name]") with quick-action buttons: `Book Appointment` (primary) and `Join Virtual Queue` (secondary).
  - **Main Area (Split 70/30)**:
    - **Left Column (70%) — "Active Bookings"**:
      - Carousel or vertical list of booking cards.
      - Each card includes: Office Name, Service, Scheduled Date & Time, Assigned Counter (if called), Status Badge (Pending, Confirmed, Called).
      - Action buttons on card: `View QR Ticket` (green), `Cancel` (red text link).
    - **Right Column (30%) — "Quick Status & Help"**:
      - *Virtual Ticket Card*: If checked-in/in-queue, shows dynamic "Ticket No. #B-104", "Current Position: 3rd in line", and "Est. Wait: 15 mins" (updates in real-time).
      - *Nearest Offices Card*: Quick links to active offices with address and current wait times.
* **States**:
  - **Empty State**: Friendly illustration stating "No upcoming appointments. Book your first appointment to get started!"
  - **In-Queue State**: Real-time card is highlighted in pulse animation, ticking down estimated wait minutes.
  - **Modal Open (QR Ticket)**: Grey overlay displaying the secure check-in QR code, office address, and check-in instructions.

---

## 3. Appointment Booking Flow

* **Purpose**: Multi-step wizard guiding Citizens or Staff (on behalf of Citizens) through scheduling an appointment.
* **Layout**:
  - **Progress Tracker**: Horizontal step bar at the top (`1. Office & Service` ➔ `2. Date & Time` ➔ `3. Confirm`).
  - **Step 1: Office & Service**:
    - Left side: Search input (by name or city), list of offices with distances.
    - Right side: Service selection list (with duration badges, e.g. "Passport Renewal - 20 min").
  - **Step 2: Date & Time**:
    - Calendar component allowing selection of days (holidays disabled, fully-booked days greyed out).
    - Time-slot selector (cards grouped into Morning/Afternoon; unavailable slots crossed out).
  - **Step 3: Review & Confirm**:
    - Summary checklist: Office Name, Full Address, Selected Service, Scheduled Date/Time, Est. Duration, and a Notes text area for user queries.
    - Checkbox: "Agree to receive SMS/Email notifications."
    - Action Buttons: `Back` (secondary) and `Confirm Booking` (primary).
* **States**:
  - **Validating Slots**: Spinner showing while checking database for double-booking.
  - **Collision Warning**: If slot was taken, displays modal: "This slot was just booked. Please select another time."
  - **Success Screen**: Shows a big checkmark, "Booking Confirmed!", QR Code, and a button `Go to Dashboard`.

---

## 4. Live Queue View

* **Purpose**: Public screen displayed on waiting-room TVs or mobile browsers showing active ticket numbers and counter calls.
* **Layout**:
  - **Header**: Office Name, current local time, and date.
  - **Main Screen (Split 60/40)**:
    - **Left Section (60%) — "NOW SERVING"**:
      - Giant card showing the latest called ticket (e.g. `Ticket A-102` to `Counter 3`).
      - Accompanied by a pulsing green ring and a chime sound (toggleable).
      - Below it: Secondary cards for other active counters (Counter 1: B-405, Counter 2: C-202).
    - **Right Section (40%) — "WAITING LIST"**:
      - Vertical list of upcoming tickets grouped by service type.
      - Displays ticket number, service name, and estimated wait progress bar.
  - **Footer**: Scrolling news banner or holiday announcement banner (e.g., "Office closed next Monday for National Holiday").
* **States**:
  - **Active Call**: The called ticket card flashes and expands for 5 seconds to grab attention.
  - **Disconnect Alert**: A thin orange header banner stating "Reconnecting to live queue server..." if WebSocket connectivity is lost.

---

## 5. QR Check-In Screen

* **Purpose**: Citizen-facing mobile screen or self-service kiosk check-in interface.
* **Layout**:
  - **Citizen Mobile App Interface**:
    - High-contrast, clean layout.
    - Ticket details: Service Name, Office, Date/Time, Booking ID.
    - **QR Code Box**: Large, central QR code container. Includes a security timer: "Refreshes in 45s" with a circular progress indicator (prevents static screenshot abuse).
    - Instructions: "Hold this QR code against the kiosk scanner when you arrive at the office."
    - Button: `Open in Maps` (launches directions), `Cancel Appointment`.
  - **Physical Kiosk View (Alternative)**:
    - Large screen displaying "Welcome to QFlow. Scan your QR code below to check in."
    - Graphic of a phone scanning under a barcode reader.
    - Manual option: `Don't have a QR code? Enter Email/Phone` input form.
* **States**:
  - **Default**: Shows active QR code.
  - **Scanning/Verifying**: Screen locks with a spinner overlay saying "Checking you in...".
  - **Success Overlay**: Large green checkmark, sound chime, and screen displaying: "Checked In! Your ticket is A-102. Please watch the board."
  - **Failed Check-in**: Red screen displaying: "Invalid QR Code or Too Early. Check-in opens 15m before your appointment."

---

## 6. Staff Counter Dashboard

* **Purpose**: Primary terminal console for office counter staff to call, process, and complete citizen visits.
* **Layout**:
  - **Sidebar (Left, 20%)**:
    - Staff profile, Counter status toggle (Online / Offline / Break).
    - Quick metrics: Today's served count, average service time.
  - **Main Console (Center, 55%)**:
    - **Active Ticket Box**:
      - Large display of current citizen: `Ticket A-102`, Citizen Name, Language (e.g., Spanish - alert flag!), Service Type, Notes.
      - **Timer**: Stopwatch showing time spent on current ticket (updates live in seconds).
      - **Action Controls**:
        - `Call Next` (Enabled only when idle - fetches next in queue).
        - `Start Service` (Starts stopwatch, changes status from called to processing).
        - `Complete` (Finishes service, prompts for outcome notes).
        - `No Show / Skip` (Marks citizen absent, clears console).
  - **Queue List (Right, 25%)**:
    - Vertical scrolling panel of waiting queue entries.
    - Action: `Transfer` button next to tickets to re-route them to another counter or service.
* **States**:
  - **Offline/On Break**: Console is greyed out. A large button `Start Shift` is centered.
  - **Idle**: Show "Ready to serve" message. `Call Next` is the only active button.
  - **Serving**: Show customer info, stopwatch ticking (turns amber if exceeding average duration).

---

## 7. Admin Dashboard

* **Purpose**: Administrative panel for managing offices, services, counters, staff assignments, and global configurations.
* **Layout**:
  - **Admin Sidebar**: Navigation tree (Dashboard, Office Config, Services list, Staff accounts, Holidays calendar, System logs).
  - **Overview Stats (Top Row)**: Cards for Total Offices, Active Counters, Queue Length (global), and System Health (API, DB, Redis connection states).
  - **Office Configuration Panel (Main Area)**:
    - List of offices with toggle buttons (`Active` / `Inactive`).
    - Detail view: Expandable row showing counters, assigned staff, and associated services.
    - Action Buttons: `Add Office`, `Assign Counter Staff`, `Manage Holidays`.
* **States**:
  - **Config Editing Modal**: Overlay forms to edit office addresses, coordinate locations (latitude/longitude), or working hours JSON.
  - **Warning Prompt**: Overlay on deactivating an office, requesting confirmation ("Warning: There are 25 pending appointments. Deactivating will notify affected citizens.").

---

## 8. Reports / Analytics Page

* **Purpose**: Visualizing historical queue metrics, staff efficiency, and traffic analytics.
* **Layout**:
  - **Filter Bar (Top)**: Date Range selector (Today, Week, Month, Custom), Office filter, Service filter.
  - **Key Metrics Row**:
    - *Average Wait Time* (e.g., "14.2 min") with percentage change icon.
    - *Average Service Duration* (e.g., "8.7 min").
    - *No-Show Rate* (e.g., "4.5%").
    - *Peak Traffic Hour* (e.g., "11:00 AM - 12:00 PM").
  - **Charts Grid (Two Columns)**:
    - **Chart A (Line Chart)**: Traffic load over time (arrived vs. completed by hour/day).
    - **Chart B (Bar Chart)**: Average wait times per service type.
  - **Staff Performance Leaderboard**:
    - Datagrid table displaying: Staff Name, Counter, Tickets Completed, Avg. Service Time, Idle Time %, Rating/Feedback score.
    - Action: `Export Report` dropdown button (options: PDF, CSV).
* **States**:
  - **Loading**: Skeleton loaders on charts and tables.
  - **No Data**: "No data found for selected date range. Try broadening your filters."
  - **Exporting**: Disabled buttons with spinner indicating PDF compilation.
