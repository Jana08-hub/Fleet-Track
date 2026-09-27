'use client';
import { useEffect, useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, statusTone, timeAgo } from '@/components/ui';

const TONES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DELAYED'];

function durationDays(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86400000));
}

export default function Trips() {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', driverId: '', source: '', destination: '', plannedStartTime: '', expectedArrivalTime: '' });
  const [msg, setMsg] = useState('');
  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);
  const formDays = durationDays(form.plannedStartTime, form.expectedArrivalTime);

  const load = (p = page, s = filter, qstr = search) => {
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (s && s !== 'ALL') params.set('status', s);
    if (qstr) params.set('q', qstr);
    api(`/api/trips?${params}`).then(d => { setItems(d.trips || []); setTotal(d.total ?? (d.trips || []).length); }).catch(() => {});
  };
  useEffect(() => {
    load(1, filter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);
  useEffect(() => {
    load();
    api('/api/vehicles').then(d => setVehicles(d.vehicles)).catch(() => {});
    api('/api/drivers').then(d => setDrivers(d.drivers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = items;

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (form.plannedStartTime && form.expectedArrivalTime && new Date(form.expectedArrivalTime) <= new Date(form.plannedStartTime)) {
      setMsg('Ending date must be after starting date.'); return;
    }
    try {
      await api('/api/trips', { method: 'POST', body: JSON.stringify(form) });
      setForm({ vehicleId: '', driverId: '', source: '', destination: '', plannedStartTime: '', expectedArrivalTime: '' }); setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
  }

  async function act(id: string, action: 'start' | 'stop' | 'cancel' | 'delay') {
    await api(`/api/trips/${id}/${action}`, { method: 'PATCH' }).catch(() => {});
    load();
  }

  return (
    <>
      <PageHeader title="Trips" sub={`${total || items.length} trips total`}
        actions={<button className="btn" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4" /> New trip</button>} />

      {showForm && (
        <form onSubmit={create} className="card card-p mb-4 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Vehicle</label>
            <select className="input" required value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle…</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.brand} {v.model}</option>)}
            </select></div>
          <div><label className="label">Driver</label>
            <select className="input" required value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })}>
              <option value="">Select driver…</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.user?.name} ({d.user?.email})</option>)}
            </select></div>
          <div><label className="label">Source</label>
            <input className="input" required placeholder="e.g. Hyderabad Depot" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></div>
          <div><label className="label">Destination</label>
            <input className="input" required placeholder="e.g. Secunderabad" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></div>
          <div><label className="label">Starting date & time</label>
            <input type="datetime-local" className="input" value={form.plannedStartTime} onChange={e => setForm({ ...form, plannedStartTime: e.target.value })} /></div>
          <div><label className="label">Ending date & time</label>
            <input type="datetime-local" className="input" value={form.expectedArrivalTime} min={form.plannedStartTime || undefined} onChange={e => setForm({ ...form, expectedArrivalTime: e.target.value })} /></div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            <span><span className="text-slate-400">Vehicle:</span> {selectedVehicle ? `${selectedVehicle.registrationNumber} — ${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}`.trim() : '—'}</span>
            <span className="tabular-nums"><span className="text-slate-400">Duration:</span> {formDays != null ? `${formDays} day${formDays === 1 ? '' : 's'}` : '— select start & end'}</span>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <button className="btn">Create trip</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {['ALL', ...TONES].map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }}
            className={`badge !px-3.5 !py-1.5 ${filter === s ? '!bg-blue-600 !text-white' : 'badge-slate'}`}>{s}</button>
        ))}
        <input className="input ml-auto max-w-[220px] !py-1.5" placeholder="Search source/destination…"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, filter, (e.target as HTMLInputElement).value); } }} />
      </div>

      <div className="grid gap-3">
        {shown.map((t: any) => (
          <div key={t.id} className="card card-p">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <p className="font-semibold">{t.source} <span className="text-slate-400">→</span> {t.destination}</p>
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              <span className="ml-auto text-xs text-slate-500">{timeAgo(t.createdAt)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              <span><span className="text-slate-400">Vehicle:</span> {t.vehicle?.registrationNumber || '—'}</span>
              <span><span className="text-slate-400">Driver:</span> {t.driver?.user?.name || '—'}</span>
              {t.plannedStartTime && <span className="tabular-nums"><span className="text-slate-400">Start:</span> {new Date(t.plannedStartTime).toLocaleString()}</span>}
              {t.expectedArrivalTime && <span className="tabular-nums"><span className="text-slate-400">End:</span> {new Date(t.expectedArrivalTime).toLocaleString()}</span>}
              {(() => { const d = durationDays(t.plannedStartTime, t.expectedArrivalTime); return d != null ? <span className="tabular-nums"><span className="text-slate-400">Duration:</span> {d} day{d === 1 ? '' : 's'}</span> : null; })()}
              <span className="tabular-nums"><span className="text-slate-400">Distance:</span> {(t.totalDistance || 0).toFixed(1)} km</span>
              {t.averageSpeed ? <span className="tabular-nums"><span className="text-slate-400">Avg:</span> {t.averageSpeed.toFixed(0)} km/h</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.status === 'PLANNED' && <><button className="btn !py-1.5 text-xs" onClick={() => act(t.id, 'start')}>Start</button><button className="btn-ghost !py-1.5 text-xs" onClick={() => act(t.id, 'delay')}>Mark delayed</button><button className="btn-ghost !py-1.5 text-xs" onClick={() => act(t.id, 'cancel')}>Cancel</button></>}
              {t.status === 'ACTIVE' && <><button className="btn !py-1.5 text-xs" onClick={() => act(t.id, 'stop')}>Complete trip</button><button className="btn-ghost !py-1.5 text-xs" onClick={() => act(t.id, 'delay')}>Mark delayed</button></>}
              {t.status === 'DELAYED' && <><button className="btn !py-1.5 text-xs" onClick={() => act(t.id, 'start')}>Resume</button><button className="btn-ghost !py-1.5 text-xs" onClick={() => act(t.id, 'cancel')}>Cancel</button></>}
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="card"><Empty title="No trips" sub={filter === 'ALL' ? 'Create your first trip above.' : `No ${filter} trips.`} /></div>}
      </div>
      {total > limit && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
          <span className="text-slate-500">Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
          <button className="btn-ghost" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}
