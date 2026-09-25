import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import analyticsRouter from './routes/analytics.js';
import simulateRouter from './routes/simulate.js';
import { vehicles, drivers, trips, gps, alerts, maintenance, geofences } from './routes/resources.js';
import { initSocket } from './socket.js';

// ---- Single-host mode: UI + API + Socket.IO on ONE port ----
// Port 3000 is taken on this machine by another project (servex), so single-host defaults to 3100.
// Override with SINGLE_PORT=3000 if that port is free.
const PORT = Number(process.env.SINGLE_PORT || 3100);
const FRONTEND_DIR = path.resolve(process.cwd(), '../frontend');

// Force same-origin URLs BEFORE Next loads its env, so the browser
// only ever talks to this single host (no :4000 anywhere).
process.env.NEXT_PUBLIC_API_URL ||= `http://localhost:${PORT}`;
process.env.NEXT_PUBLIC_SOCKET_URL ||= `http://localhost:${PORT}`;
process.env.NEXT_PUBLIC_APP_URL ||= `http://localhost:${PORT}`;

// `next` is installed in frontend/node_modules; resolve it from there.
const requireFromFrontend = createRequire(path.join(FRONTEND_DIR, 'package.json'));
const nextPkg: any = requireFromFrontend('next');

async function main() {
  // Production serve (prebuilt .next) when SINGLE_PROD=1 or NODE_ENV=production;
  // otherwise fast-iteration dev mode.
  const isProd = process.env.SINGLE_PROD === '1' || process.env.NODE_ENV === 'production';
  const nextApp = nextPkg({ dev: !isProd, dir: FRONTEND_DIR, port: PORT });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'fleettrack-single-host' }));

  // ---- Backend data lives here (same origin, no extra host) ----
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/vehicles', vehicles);
  app.use('/api/drivers', drivers);
  app.use('/api/trips', trips);
  app.use('/api/gps', gps);
  app.use('/api/alerts', alerts);
  app.use('/api/maintenance', maintenance);
  app.use('/api/geofences', geofences);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/admin/simulate', simulateRouter);

  app.post('/api/simulate/location', (req, res) => {
    if (process.env.SIMULATION_ENABLED !== 'true') return res.status(403).json({ error: 'Simulation disabled' });
    res.json({ demo: true, message: 'DEMO DATA — use POST /api/gps/location with isSimulated:true', echo: req.body || {} });
  });

  // ---- Everything else is the Next.js frontend ----
  app.all('*', (req: any, res: any) => handle(req, res));

  const server = http.createServer(app);
  initSocket(server);
  server.listen(PORT, () => console.log(`FleetTrack single-host on http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
