'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { api, SOCKET_URL } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });
const FitBounds = dynamic(() => import('@/components/fit-bounds').then(m => m.FitBounds), { ssr: false });

const ONLINE_AFTER_MS = 120_000;

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_AFTER_MS;
}

export default function LiveTracking() {
  const [L, setL] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [live, setLive] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const [sim, setSim] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { import('leaflet').then(m => setL(m.default || m)); }, []);

  const loadVehicles = async () => {
    try { const d = await api('/api/vehicles'); setVehicles(d.vehicles); } catch {}
  };
  useEffect(() => {
    loadVehicles();
    const t = setInterval(loadVehicles, 5000); // polling fallback behind Socket.IO
    const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
    const s: Socket = io(SOCKET_URL, { auth: { token } });
    s.emit('join-admin-room');
    s.on('vehicle-location-updated', (p: any) => setLive(prev => ({ ...prev, [p.vehicleId]: p })));
    s.on('new-alert', () => setMsg('New alert received — see Alerts page'));
    api('/api/admin/simulate/status').then(setSim).catch(() => {});
    return () => { clearInterval(t); s.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selected) { setTrail([]); return; }
    api(`/api/gps/vehicles/${selected}/history?limit=200`)
      .then(d => setTrail([...(d.points || [])].reverse().map((p: any) => [p.latitude, p.longitude] as [number, number])))
      .catch(() => {});
  }, [selected]);

  const icons = useMemo(() => {
    if (!L) return null;
    const dot = (color: string, pulse: boolean) => new L.DivIcon({
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5);${pulse ? 'animation:ft-pulse 1.5s infinite;' : ''}"></div><style>@keyframes ft-pulse{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}</style>`,
      className: '', iconSize: [18, 18], iconAnchor: [9, 9],
    });
    return { online: dot('#16a34a', true), offline: dot('#64748b', false), stale: dot('#f59e0b', false) };
  }, [L]);

  const rows = vehicles
    .map(v => {
      const p = live[v.id];
      const lat = p?.latitude ?? v.lastLat;
      const lng = p?.longitude ?? v.lastLng;
      const seen = p?.serverTimestamp ?? v.lastSeenAt;
      return { v, p, lat, lng, seen, online: isOnline(seen), demo: !!(p?.demo || p?.isSimulated) };
    })
    .filter(r => r.v.registrationNumber.toLowerCase().includes(filter.toLowerCase()))
    .filter(r => !onlyOnline || r.online);

  const withFix = rows.filter(r => r.lat != null && r.lng != null);
  const bounds = withFix.map(r => [r.lat, r.lng] as [number, number]);

  async function toggleSim() {
    setMsg('');
    try {
      if (sim?.running) await api('/api/admin/simulate/stop', { method: 'POST' });
      else await api('/api/admin/simulate/start', { method: 'POST' });
      setSim(await api('/api/admin/simulate/status'));
    } catch (e: any) { setMsg(e.message); }
  }

  return (<main>
    <PageHeader title="Live tracking" sub={sim?.running ? 'Simulation live — DEMO DATA' : 'Real-time vehicle positions'}
      actions={<>
        <input className="input max-w-[200px] !py-2" placeholder="Search vehicle" value={filter} onChange={e => setFilter(e.target.value)} />
        <label className="btn-ghost cursor-pointer !py-2 text-xs"><input type="checkbox" className="accent-blue-600" checked={onlyOnline} onChange={e => setOnlyOnline(e.target.checked)} /> Online only</label>
        <button className="btn !py-2" onClick={toggleSim}>{sim?.running ? 'Stop demo' : 'Start demo'}</button>
      </>} />
    {sim?.running && <p className="mb-3"><Badge tone="amber">DEMO DATA — simulated movement, not real GPS</Badge></p>}
    {msg && <p className="mb-3 text-sm">{msg}</p>}
    <div className="card overflow-hidden !p-0">
      <div className="h-[52vh] min-h-[380px]">
      {L ? (
      <MapContainer center={[17.385, 78.4867]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        <FitBounds points={bounds} />
        {withFix.map(r => (
          <Marker key={r.v.id} position={[r.lat, r.lng]} icon={r.online ? icons?.online : icons?.offline}
            eventHandlers={{ click: () => setSelected(r.v.id) }}>
            <Popup>
              <b>{r.v.registrationNumber}</b> {r.demo && '(DEMO)'}<br />
              Status: {r.v.status} · {r.online ? 'online' : 'offline'}<br />
              Speed: {r.p?.speed != null ? `${Number(r.p.speed).toFixed(0)} km/h` : '—'}<br />
              Updated: {r.seen ? timeAgo(r.seen) : 'never'}
            </Popup>
          </Marker>
        ))}
        {trail.length > 1 && <Polyline positions={trail} />}
      </MapContainer>
      ) : <p className="p-4">Loading map…</p>}
      </div>
    </div>
    <div className="card card-p mt-4">
      <h2 className="font-bold">Vehicles ({rows.length}) <span className="font-normal text-slate-500">— select for route trail</span></h2>
      <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm">
        {rows.map(r => (
          <li key={r.v.id}>
            <button className="font-semibold text-blue-600 hover:underline" onClick={() => setSelected(r.v.id)}>
              <Badge tone={r.online ? 'green' : 'slate'}>{r.online ? 'Online' : 'Offline'}</Badge>{' '}{r.v.registrationNumber}
            </button>
            {' '}· {r.v.status}
            {r.lat != null ? ` · ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : ' · no fix yet'}
            {r.demo && <> · <Badge tone="amber">DEMO</Badge></>}
            {r.seen && <span className="text-slate-500"> · {timeAgo(r.seen)}</span>}
          </li>
        ))}
        {rows.length === 0 && <li className="text-slate-500">No vehicles match.</li>}
      </ul>
    </div>
  </main>);
}
