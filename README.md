# 🚘 FleetTrack — Real-Time Fleet Tracking (Software GPS)

Split architecture per build: **frontend/** holds only UI, **backend/** holds all data + APIs.

## Structure
- `frontend/` — Next.js 14 App Router + Tailwind + Leaflet/OpenStreetMap. Calls backend via `NEXT_PUBLIC_API_URL`. Pages: `/login /register /verify-email /forgot-password /reset-password /pending-approval`, `/admin/*` (dashboard, email-verification, live-tracking, vehicles, drivers, trips, geofences, alerts, maintenance, analytics), `/driver/*` (dashboard, tracking with `watchPosition`, trips).
- `backend/` — Express + Socket.IO + Prisma + PostgreSQL. Routes: `/api/auth/*`, `/api/admin/*`, `/api/vehicles`, `/api/drivers`, `/api/trips`, `/api/gps/location`, `/api/alerts`, `/api/maintenance`, `/api/geofences`, `/api/analytics`. Email via Nodemailer SMTP (stub logs when unconfigured). Socket rooms: `join-admin-room`, `join-driver-room`, `start/stop-tracking`, `send-gps-update` → `vehicle-location-updated`, `trip-status-updated`, `new-alert`, `geofence-event`, `verification-status-updated`.

## Quick start — single host (one link, Neon Postgres)
Prerequisite: `neon link` already done in this folder (project `round-recipe-77879556`, branch `production`); connection strings live in root `.env.local` (git-ignored).
1. `cd backend; npm install`
2. `npm run setup` — migrates the Neon DB (`DIRECT_URL`) and seeds admin + demo driver + 3 vehicles + geofence.
3. `npm run dev` from repo root (or `npm run dev:single` in `backend/`).
4. Open **http://localhost:3100** — UI + API + live Socket.IO all on this one link. (Port 3000 was taken by another project on this machine, so single-host defaults to 3100; override with `SINGLE_PORT=3000`.)
5. Log in as admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`), open Live tracking → **Start demo** → watch vehicles move in real time (labeled ⚠️ DEMO).
6. Re-verify anytime: `cd backend; node e2e-realtime.mjs` (needs the single-host server running).

## Quick start — separated (two links, optional)
1. `cp backend/.env.example backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, SMTP.
2. `cp frontend/.env.example frontend/.env.local`
3. Backend: `cd backend; npm install; npx prisma migrate dev; npm run prisma:seed; npm run dev` (port 4000)
4. Frontend: `cd frontend; npm install; npm run dev` (port 3000)
5. Login with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Registration with email OTP (driver onboarding)
1. User enters name, email, password, phone, license number/expiry on `/register`.
2. `POST /api/auth/register/request-otp` stores a hashed 6-digit code (10-min expiry, 60s resend cooldown) and emails it.
3. User enters the code → `POST /api/auth/register/verify-otp` checks it (5 attempts max, single-use, timing-safe compare) and creates a verified **DRIVER** user + driver profile + account, pending admin approval.
4. Admin approves from Email Verification / Users; driver logs in (unapproved logins land on `/pending-approval`).

## Email delivery + admin catcher
- All mail flows through `sendMail()` (SMTP via env, stub-logged when unconfigured).
- `EMAIL_REDIRECT_TO` (set to the admin inbox) reroutes **every** outgoing email there, prefixing the subject with the original recipient. `EmailLog.recipientEmail` records where each mail actually landed.

## GPS workflow
Driver → `/driver/tracking` → select trip → Start → browser asks permission → `watchPosition` posts to `POST /api/gps/location` (validated lat -90..90, lng -180..180, accuracy, trip ownership) → backend stores `GPSLocation`, updates `Vehicle.lastLat/lng`, checks geofences, emits Socket.IO → admin map updates. Stop calls `PATCH /trips/:id/stop` + `clearWatch`. Note: browser GPS needs the page open; no guaranteed background tracking.

## Demo simulation (real-time, no phone needed)
Admin-only `POST /api/admin/simulate/start|stop`, `GET /api/admin/simulate/status`. Every 3s each assigned vehicle moves, writes a `GPSLocation (isSimulated)`, and broadcasts `vehicle-location-updated` over Socket.IO. UI labels it `DEMO DATA` / `(DEMO)`, never as live GPS. Tip: assign drivers to DEMO-002/003 to simulate the whole fleet (seed assigns DEMO-001).

## Security
JWT httpOnly cookie + Bearer, bcrypt (12 rounds), admin-only email send with rate limit, SHA-256 tokenHash, 24h single-use links, Zod validation, helmet/cors/rate-limit, audit logs, IDOR guard on trips/GPS.
