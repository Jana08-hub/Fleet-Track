import 'dotenv/config';
import express from 'express';
import http from 'http';
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
import { startDueChecks } from './services/scheduler.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Behind Render/Heroku-style proxies: trust X-Forwarded-* for correct IPs,
// rate limiting and secure cookies.
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'fleettrack-backend' }));

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

// Simulation mode — clearly labeled DEMO DATA
app.post('/api/simulate/location', async (req, res) => {
  if (process.env.SIMULATION_ENABLED !== 'true') return res.status(403).json({ error: 'Simulation disabled' });
  const { vehicleId, tripId, lat, lng, speed } = req.body || {};
  // Forward as simulated point via internal logic marker
  res.json({ demo: true, message: 'DEMO DATA — use POST /api/gps/location with isSimulated:true', echo: { vehicleId, tripId, lat, lng, speed } });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
initSocket(server);
startDueChecks();
server.listen(PORT, () => console.log(`FleetTrack backend on :${PORT}`));
