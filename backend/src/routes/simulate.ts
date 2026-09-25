import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { startSimulation, stopSimulation, status } from '../services/simulator.js';

const r = Router();
r.use(requireAuth, requireAdmin);

r.post('/start', async (_req, res) => {
  try {
    res.json(await startSimulation());
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
r.post('/stop', async (_req, res) => {
  res.json(stopSimulation());
});
r.get('/status', async (_req, res) => {
  res.json(status());
});

export default r;
