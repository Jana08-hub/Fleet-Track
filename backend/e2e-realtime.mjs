// E2E realtime proof: login -> socket connect -> start demo sim ->
// receive live vehicle-location-updated -> stop. Exit 0 on PASS.
import fs from 'fs';
import { createRequire } from 'module';

const BASE = process.env.E2E_BASE || 'http://localhost:3100';
const frontendRequire = createRequire('D:/ARM TRAVELS/frontend/package.json');
const { io } = frontendRequire('socket.io-client');

function seedCreds() {
  let email = 'admin@fleettrack.example';
  let password = 'Admin@12345';
  try {
    for (const ln of fs.readFileSync('D:/ARM TRAVELS/backend/.env', 'utf8').split('\n')) {
      const m = ln.match(/^\s*SEED_ADMIN_EMAIL\s*=\s*(.+)\s*$/);
      if (m) email = m[1].trim();
      const p = ln.match(/^\s*SEED_ADMIN_PASSWORD\s*=\s*(.+)\s*$/);
      if (p) password = p[1].trim();
    }
  } catch {}
  return { email, password };
}

async function api(path, token, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

const { email, password } = seedCreds();
console.log('1) login as', email);
const login = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password }) });
const token = login.token;
console.log('   login OK, role =', login.user.role);

console.log('2) socket connect + join-admin-room');
const received = [];
const socket = io(BASE, { auth: { token } });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('socket connect timeout')), 15000);
  socket.on('connect', () => { clearTimeout(t); resolve(); });
  socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
});
socket.emit('join-admin-room');
socket.on('vehicle-location-updated', (p) => received.push(p));
console.log('   socket connected:', socket.id);

console.log('3) start demo simulation');
const started = await api('/api/admin/simulate/start', token, { method: 'POST' });
console.log('   running =', started.running, '| vehicles =', started.vehicles.length);

console.log('4) waiting ~10s for live GPS over socket…');
await new Promise((r) => setTimeout(r, 10000));
console.log(`   received ${received.length} live location events`);
const demoCount = received.filter((p) => p.demo || p.isSimulated).length;
console.log(`   of which DEMO-labeled: ${demoCount}`);
if (received.length === 0) throw new Error('FAIL: no live GPS events received');

console.log('5) sample event:', JSON.stringify({ vehicleId: received[0].vehicleId, lat: received[0].latitude, lng: received[0].longitude, speed: received[0].speed, demo: received[0].demo }));
console.log('6) stop simulation');
const stopped = await api('/api/admin/simulate/stop', token, { method: 'POST' });
console.log('   running =', stopped.running);
socket.disconnect();

if (stopped.running) throw new Error('FAIL: sim still running');
console.log('E2E_REALTIME=PASS');
