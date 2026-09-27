'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Play, Square, Pause, Satellite, WifiOff, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, statusTone } from '@/components/ui';
import { useGpsTracker } from '@/hooks/use-gps-tracker';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });
const FitBounds = dynamic(() => import('@/components/fit-bounds').then(m => m.FitBounds), { ssr: false });

const STATUS_COPY: Record<string, { label: string; tone: string; hint: string }> = {
  idle: { label: 'Idle', tone: 'slate', hint: 'Select a trip and tap Start Trip.' },
  active: { label: 'Sharing location', tone: 'green', hint: 'Keep this page open. Updates every few seconds.' },
  denied: { label: 'Permission denied', tone: 'red', hint: 'Location permission is required to start live tracking. Enable it in browser settings, then retry.' },
  error: { label: 'GPS error', tone: 'red', hint: 'GPS signal is unavailable. Please move to an area with better GPS reception.' },
  offline: { label: 'You are offline', tone: 'amber', hint: 'Reconnect to send positions.' },
};

export default function Tracking() {
  const [L, setL] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [tripId, setTripId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState('');
  const { status, last, queued, poorAccuracy, trail, flush } = useGpsTracker({ vehicleId, tripId, enabled: active && !paused && !!tripId && !!vehicleId });

  useEffect(() => { import('leaflet').then(m => setL(m.default || m)); }, []);
  useEffect(() => {
    api('/api/auth/me').then(setMe).catch(() => {});
    api('/api/trips?limit=100').then(d => setTrips((d.trips || []).filter((t: any) => ['ACTIVE', 'PLANNED', 'DELAYED'].includes(t.status)))).catch(() => {});
  }, []);

  // Only my trips can be started (server rejects others with "not your trip").
  const mine = me ? trips.filter((t: any) => t.driver?.user?.id === me.id) : trips;
  const selected = mine.find(t => t.id === tripId);
  const s = STATUS_COPY[active ? (paused ? 'idle' : status) : 'idle'];

  async function start() {
    if (!tripId) return;
    setBusy(true); setNotice(''); setDone('');
    const t = mine.find(x => x.id === tripId);
    if (t) setVehicleId(t.vehicleId);
    const r = await api(`/api/trips/${tripId}/start`, { method: 'PATCH' }).catch((e: any) => { setNotice(e.message); return null; });
    if (r) { setActive(true); setPaused(false); flush(); }
    setBusy(false);
  }
  async function end() {
    setBusy(true); setNotice(''); setDone('');
    const r = await api(`/api/trips/${tripId}/stop`, { method: 'PATCH' }).catch((e: any) => { setNotice(e.message); return null; });
    if (r) {
      setActive(false); setPaused(false);
      setDone(`Trip completed — ${(r.totalDistance || 0).toFixed(1)} km travelled.`);
      setTrips(prev => prev.map(t => t.id === tripId ? r : t));
    }
    setBusy(false);
  }

  const icons = useMemo(() => {
    if (!L) return null;
    const dot = (color: string, pulse: boolean) => new L.DivIcon({
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5);${pulse ? 'animation:ft-pulse 1.5s infinite;' : ''}"></div><style>@keyframes ft-pulse{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}</style>`,
      className: '', iconSize: [18, 18], iconAnchor: [9, 9],
    });
    return { vehicle: dot('#16a34a', true), start: dot('#2563eb', false), dest: dot('#dc2626', false) };
  }, [L]);

  const fix: [number, number] | null = last && !last.rejected && last.latitude != null
    ? [last.latitude, last.longitude] : (trail.length ? trail[trail.length - 1] : null);
  const startPt: [number, number] | null = selected?.startLatitude != null && selected?.startLongitude != null
    ? [selected.startLatitude, selected.startLongitude] : null;
  const destPt: [number, number] | null = selected?.destinationLatitude != null && selected?.destinationLongitude != null
    ? [selected.destinationLatitude, selected.destinationLongitude] : null;
  const bounds = [...(fix ? [fix] : []), ...(startPt ? [startPt] : []), ...(destPt ? [destPt] : []), ...trail];

  return (
    <>
      <h1 className="page-title">GPS tracking</h1>
      <p className="page-sub">Browser GPS works while this page stays open.</p>

      <div className="card card-p mt-4 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${active && !paused && status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
          {status === 'offline' ? <WifiOff className="h-7 w-7" /> : <Satellite className="h-7 w-7" />}
        </span>
        <p className="mt-3 flex items-center justify-center gap-2">
          <Badge tone={s.tone}>{active && paused ? 'Paused' : s.label}</Badge>
          {active && <Badge tone={paused ? 'amber' : 'green'}>Tracking: {paused ? 'PAUSED' : 'ACTIVE'}</Badge>}
        </p>
        <p className="mt-1 text-sm text-slate-500">{active ? (paused ? 'Tracking paused — GPS is off, trip stays active.' : s.hint) : 'Select a trip and tap Start Trip.'}</p>
        {notice && <p className="mt-2 text-sm text-red-600">{notice}</p>}
        {done && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}
        {active && queued > 0 && (
          <p className="mt-2 text-sm text-amber-600">{queued} position{queued === 1 ? '' : 's'} queued offline — will send on reconnect.</p>
        )}
        {active && !paused && poorAccuracy && (
          <p className="mt-2 text-sm text-amber-600">Weak GPS fix (&gt;100m accuracy) — move outdoors for a better signal.</p>
        )}
        {last?.rejected && (
          <p className="mt-2 text-sm text-red-600">Last fix rejected: accuracy &gt;5000m. Waiting for a better fix.</p>
        )}
        {last?.queued && (
          <p className="mt-2 text-sm text-amber-600">Offline — position stored locally.</p>
        )}
        {last && !last.rejected && (
          <div className="mx-auto mt-3 grid max-w-lg grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Last updated</p><p className="text-sm font-bold">{last.at ? new Date(last.at).toLocaleTimeString() : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Accuracy</p><p className="text-sm font-bold tabular-nums">{last.accuracy != null ? `${Math.round(last.accuracy)}m` : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Speed</p><p className="text-sm font-bold tabular-nums">{last.speed != null ? `${Math.round(last.speed)} km/h` : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Latitude</p><p className="text-sm font-bold tabular-nums">{last.latitude != null ? Number(last.latitude).toFixed(5) : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Longitude</p><p className="text-sm font-bold tabular-nums">{last.longitude != null ? Number(last.longitude).toFixed(5) : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Heading</p><p className="text-sm font-bold tabular-nums">{last.heading != null ? `${Math.round(last.heading)}°` : '—'}</p></div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden !p-0 mt-4">
        <div className="h-[42vh] min-h-[300px]">
          {L ? (
            <MapContainer center={[17.385, 78.4867]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
              <FitBounds points={bounds} />
              {startPt && <Marker position={startPt} icon={icons?.start}><Popup>Start: {selected?.source}</Popup></Marker>}
              {destPt && <Marker position={destPt} icon={icons?.dest}><Popup>Destination: {selected?.destination}</Popup></Marker>}
              {trail.length > 1 && <Polyline positions={trail} />}
              {fix && <Marker position={fix} icon={icons?.vehicle}><Popup><b>Current position</b><br />{fix[0].toFixed(5)}, {fix[1].toFixed(5)}</Popup></Marker>}
            </MapContainer>
          ) : <p className="p-4">Loading map…</p>}
        </div>
      </div>

      <div className="card card-p mt-4 space-y-4">
        <div>
          <label className="label">Trip</label>
          <select className="input !py-3" value={tripId} onChange={e => setTripId(e.target.value)} disabled={active}>
            <option value="">{mine.length ? 'Select a trip…' : 'No trips assigned yet — create one first.'}</option>
            {mine.map(t => <option key={t.id} value={t.id}>{t.source} → {t.destination} ({t.status})</option>)}
          </select>
          <p className="mt-1 text-right text-xs"><Link className="font-semibold text-blue-600 hover:underline" href="/driver/trips">+ New trip</Link></p>
        </div>
        {selected && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <p className="font-semibold">{selected.source} → {selected.destination} <Badge tone={statusTone(selected.status)}>{selected.status}</Badge></p>
            <p className="mt-1 text-slate-500">Vehicle: {selected.vehicle?.registrationNumber || '—'} · Driver: {selected.driver?.user?.name || '—'}</p>
            {(selected.plannedStartTime || selected.expectedArrivalTime) && (
              <p className="mt-1 tabular-nums text-slate-500">
                {selected.plannedStartTime ? `Start: ${new Date(selected.plannedStartTime).toLocaleString()}` : ''}
                {selected.plannedStartTime && selected.expectedArrivalTime ? ' · ' : ''}
                {selected.expectedArrivalTime ? `End: ${new Date(selected.expectedArrivalTime).toLocaleString()}` : ''}
              </p>
            )}
            {selected.purpose && <p className="mt-1 text-slate-500">Purpose: {selected.purpose}</p>}
            {(selected.stops || []).length > 0 && (
              <p className="mt-1 text-slate-500">Stops: {selected.stops.map((x: any) => x.name).join(' → ')}</p>
            )}
          </div>
        )}
        {!active ? (
          <button className="btn w-full !py-4 text-base" onClick={start} disabled={!tripId || busy}>
            <Play className="h-5 w-5" /> {busy ? 'Starting…' : 'Start Trip'}
          </button>
        ) : !paused ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn w-full !py-4 text-base" onClick={() => setPaused(true)}><Pause className="h-5 w-5" /> Pause Tracking</button>
            <button className="btn-danger w-full !py-4 text-base" onClick={end} disabled={busy}><Square className="h-5 w-5" /> {busy ? 'Ending…' : 'End Trip'}</button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn w-full !py-4 text-base" onClick={() => { setPaused(false); flush(); }}><Play className="h-5 w-5" /> Resume Tracking</button>
            <button className="btn-danger w-full !py-4 text-base" onClick={end} disabled={busy}><Square className="h-5 w-5" /> {busy ? 'Ending…' : 'End Trip'}</button>
          </div>
        )}
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Keep this page open and the screen awake for reliable browser GPS tracking. Mobile browsers don&apos;t guarantee background tracking.
        </p>
      </div>
    </>
  );
}
