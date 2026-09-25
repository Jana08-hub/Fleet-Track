'use client';
import { useEffect, useState } from 'react';
import { Play, Square, Satellite, WifiOff, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, statusTone } from '@/components/ui';
import { useGpsTracker } from '@/hooks/use-gps-tracker';

const STATUS_COPY: Record<string, { label: string; tone: string; hint: string }> = {
  idle: { label: 'Idle', tone: 'slate', hint: 'Select a trip and tap Start.' },
  active: { label: 'Sharing location', tone: 'green', hint: 'Keep this page open. Updates every few seconds.' },
  denied: { label: 'Permission denied', tone: 'red', hint: 'Enable location in your browser settings, then retry.' },
  error: { label: 'GPS error', tone: 'red', hint: 'Check signal and network, then retry.' },
  offline: { label: 'You are offline', tone: 'amber', hint: 'Reconnect to send positions.' },
};

export default function Tracking() {
  const [trips, setTrips] = useState<any[]>([]);
  const [tripId, setTripId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const { status, last } = useGpsTracker({ vehicleId, tripId, enabled: active && !!tripId && !!vehicleId });

  useEffect(() => {
    api('/api/trips').then(d => setTrips((d.trips || []).filter((t: any) => t.status === 'ACTIVE' || t.status === 'PLANNED'))).catch(() => {});
  }, []);

  const selected = trips.find(t => t.id === tripId);
  const s = STATUS_COPY[active ? status : 'idle'];

  async function start() {
    if (!tripId) return;
    setBusy(true);
    const t = trips.find(x => x.id === tripId);
    if (t) setVehicleId(t.vehicleId);
    await api(`/api/trips/${tripId}/start`, { method: 'PATCH' }).catch(() => {});
    setActive(true); setBusy(false);
  }
  async function stop() {
    setBusy(true);
    await api(`/api/trips/${tripId}/stop`, { method: 'PATCH' }).catch(() => {});
    setActive(false); setBusy(false);
  }

  return (
    <>
      <h1 className="page-title">GPS tracking</h1>
      <p className="page-sub">Browser GPS works while this page stays open.</p>

      <div className="card card-p mt-4 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${active && status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
          {status === 'offline' ? <WifiOff className="h-7 w-7" /> : <Satellite className="h-7 w-7" />}
        </span>
        <p className="mt-3"><Badge tone={s.tone}>{s.label}</Badge></p>
        <p className="mt-1 text-sm text-slate-500">{active ? s.hint : 'Select a trip and tap Start.'}</p>
        {last && (
          <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Last fix</p><p className="text-sm font-bold">{new Date(last.at).toLocaleTimeString()}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Accuracy</p><p className="text-sm font-bold tabular-nums">{last.accuracy != null ? `${Math.round(last.accuracy)}m` : '—'}</p></div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Speed</p><p className="text-sm font-bold tabular-nums">{last.speed != null ? `${Math.round(last.speed)}` : '—'}</p></div>
          </div>
        )}
      </div>

      <div className="card card-p mt-4 space-y-4">
        <div>
          <label className="label">Trip</label>
          <select className="input !py-3" value={tripId} onChange={e => setTripId(e.target.value)} disabled={active}>
            <option value="">Select a trip…</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.source} → {t.destination} ({t.status})</option>)}
          </select>
        </div>
        {selected && (
          <p className="text-sm text-slate-500">Vehicle <Badge tone={statusTone(selected.status)}>{selected.status}</Badge> {selected.vehicle?.registrationNumber}</p>
        )}
        {!active ? (
          <button className="btn w-full !py-4 text-base" onClick={start} disabled={!tripId || busy}>
            <Play className="h-5 w-5" /> {busy ? 'Starting…' : 'Start trip + GPS'}
          </button>
        ) : (
          <button className="btn-danger w-full !py-4 text-base" onClick={stop} disabled={busy}>
            <Square className="h-5 w-5" /> {busy ? 'Stopping…' : 'Stop trip'}
          </button>
        )}
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Mobile browsers don&apos;t guarantee background tracking — keep this page open and the screen awake.
        </p>
      </div>
    </>
  );
}
