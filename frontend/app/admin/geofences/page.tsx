'use client';
import { useEffect, useState } from 'react';
import { Plus, Hexagon, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';

export default function Geofences() {
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: '500' });
  const [msg, setMsg] = useState('');

  const load = (vehicleId = vehicleFilter, onlyActive = activeOnly) => {
    const params = new URLSearchParams();
    if (vehicleId) params.set('vehicleId', vehicleId);
    if (onlyActive) params.set('activeOnly', 'true');
    api(`/api/geofences?${params}`).then(d => { setItems(d.geofences); setEvents(d.events || []); }).catch(() => {});
  };
  useEffect(() => { load(); api('/api/vehicles').then(d => setVehicles(d.vehicles || [])).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleFilter, activeOnly]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const lat = Number(form.latitude), lng = Number(form.longitude), radius = Number(form.radius);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return setMsg('Latitude must be -90…90');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return setMsg('Longitude must be -180…180');
    if (!Number.isFinite(radius) || radius < 10 || radius > 100000) return setMsg('Radius must be 10–100000 m');
    try {
      await api('/api/geofences', { method: 'POST', body: JSON.stringify({ name: form.name, latitude: lat, longitude: lng, radius }) });
      setForm({ name: '', latitude: '', longitude: '', radius: '500' }); setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
  }

  async function toggleActive(g: any) {
    await api(`/api/geofences/${g.id}`, { method: 'PATCH', body: JSON.stringify({ active: !g.active }) }).catch(() => {});
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this geofence?')) return;
    await api(`/api/geofences/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <PageHeader title="Geofences" sub="Circular zones with entry / exit detection"
        actions={<button className="btn" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4" /> New geofence</button>} />

      {showForm && (
        <form onSubmit={create} className="card card-p mb-4 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Name</label>
            <input className="input" required placeholder="e.g. Hyderabad Depot" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Radius (meters)</label>
            <input className="input" type="number" min="10" required value={form.radius} onChange={e => setForm({ ...form, radius: e.target.value })} /></div>
          <div><label className="label">Latitude</label>
            <input className="input" required placeholder="17.385" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
          <div><label className="label">Longitude</label>
            <input className="input" required placeholder="78.4867" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <button className="btn">Save geofence</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input max-w-[220px] !py-2" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}>
          <option value="">All vehicles (events)</option>
          {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active only
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(g => (
          <div key={g.id} className="card card-p">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Hexagon className="h-5 w-5" /></span>
              <div><p className="font-bold">{g.name}</p><p className="text-xs tabular-nums text-slate-500">{Number(g.latitude).toFixed(4)}, {Number(g.longitude).toFixed(4)} · {g.radius}m</p></div>
              <button title="Toggle active" onClick={() => toggleActive(g)}><Badge tone={g.active ? 'green' : 'slate'}>{g.active ? 'Active' : 'Off'}</Badge></button>
              <button className="btn-ghost ml-auto !p-2 !text-red-600" title="Delete" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <div className="card mt-3"><Empty title="No geofences" sub="Create your first zone above." /></div>}

      <div className="card card-p mt-4">
        <h2 className="font-bold">Recent zone events</h2>
        {events.length === 0 && <p className="mt-2 text-sm text-slate-500">Entry and exit events appear here in real time.</p>}
        <ul className="mt-2 space-y-1.5 text-sm">
          {events.slice(0, 15).map((e: any) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={e.eventType === 'GEOZONE_ENTRY' ? 'green' : 'blue'}>{e.eventType.replaceAll('_', ' ')}</Badge>
              <span className="font-medium">{e.geofence?.name || ''}</span>
              <span className="tabular-nums text-slate-500">{e.vehicle?.registrationNumber || ''}</span>
              <span className="text-slate-500">{timeAgo(e.occurredAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
