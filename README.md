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

## Deploy to production (Vercel frontend + Render backend + Neon DB)
Socket.IO needs a long-running server, so the frontend goes to Vercel and the
backend to Render. Both talk to the same Neon Postgres (Singapore).

### 1. Push to GitHub
```bash
cd "D:\ARM TRAVELS"
git remote add origin https://github.com/<you>/fleettrack.git
git branch -M main
git push -u origin main
```
Secrets are git-ignored (`.env`, `.env.local`); only `.env.example` files are committed.

### 2. Backend → Render (one click via blueprint)
1. Render dashboard → New → **Blueprint** → select the repo (`render.yaml` at root).
2. Fill the `sync: false` env vars:
   `DATABASE_URL` (Neon pooled + `?pgbouncer=true`), `DIRECT_URL` (Neon direct),
   `APP_URL` + `FRONTEND_URL` (your Vercel URL, set after step 3),
   `SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM`, `EMAIL_REDIRECT_TO`.
   `JWT_SECRET` is auto-generated; `TRUST_PROXY=1`, `CROSS_SITE_AUTH=true` are preset.
3. Deploy. Build runs `prisma generate + migrate deploy + build`; health check is `/health`.

### 3. Frontend → Vercel
1. Vercel → Add New Project → import the repo, **Root Directory = `frontend`**.
2. Environment variables:
   `NEXT_PUBLIC_API_URL=https://<render-backend>.onrender.com`,
   `NEXT_PUBLIC_SOCKET_URL=https://<render-backend>.onrender.com`,
   `NEXT_PUBLIC_APP_URL=https://<your-app>.vercel.app`,
   `NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.
3. Deploy, then go back to Render and set `APP_URL`/`FRONTEND_URL` to the Vercel URL.

### 4. Seed production data (one time, from your machine)
```bash
cd backend
DATABASE_URL="<neon-direct-url>" DIRECT_URL="<neon-direct-url>" npm run setup
```
Then create/approve the admin via the UI or a SQL update. Demo simulation runs on
Render too (Start demo on the live map); simulated points are always DEMO-labeled.

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
