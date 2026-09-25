'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, statusTone, timeAgo } from '@/components/ui';

const TONES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DELAYED'];

export default function Trips() {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', driverId: '', source: '', destination: '' });
  const [msg, setMsg] = useState('');

  const load = () => api('/api/trips').then(d => setItems(d.trips)).catch(() => {});
  useEffect(() => {
    load();
    api('/api/vehicles').then(d => setVehicles(d.vehicles)).catch(() => {});
    api('/api/drivers').then(d => setDrivers(d.drivers)).catch(() => {});
  }, []);

  const shown = useMemo(() => items.filter(t => filter === 'ALL' || t.status === filter), [items, filter]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/trips', { method: 'POST', body: JSON.stringify(form) });
      setForm({ vehicleId: '', driverId: '', source: '', destination: '' }); setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
  }

  async function act(id: string, action: 'start' | 'stop' | 'cancel') {
    await api(`/api/trips/${id}/${action}`, { method: 'PATCH' }).catch(() => {});
    load();
  }

  return (
    <>
      <PageHeader title="Trips" sub={`${items.length} trips total`}
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
          <div className="sm:col-span-2 flex items-center gap-2">
            <button className="btn">Create trip</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {['ALL', ...TONES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`badge !px-3.5 !py-1.5 ${filter === s ? '!bg-blue-600 !text-white' : 'badge-slate'}`}>{s}</button>
        ))}
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
              <span className="tabular-nums"><span className="text-slate-400">Distance:</span> {(t.totalDistance || 0).toFixed(1)} km</span>
              {t.averageSpeed ? <span className="tabular-nums"><span className="text-slate-400">Avg:</span> {t.averageSpeed.toFixed(0)} km/h</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.status === 'PLANNED' && <><button className="btn !py-1.5 text-xs" onClick={() => act(t.id, 'start')}>Start</button><button className="btn-ghost !py-1.5 text-xs" onClick={() => act(t.id, 'cancel')}>Cancel</button></>}
              {t.status === 'ACTIVE' && <button className="btn !py-1.5 text-xs" onClick={() => act(t.id, 'stop')}>Complete trip</button>}
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="card"><Empty title="No trips" sub={filter === 'ALL' ? 'Create your first trip above.' : `No ${filter} trips.`} /></div>}
      </div>
    </>
  );
}
