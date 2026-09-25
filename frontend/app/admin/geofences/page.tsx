'use client';
import { useEffect, useState } from 'react';
import { Plus, Hexagon, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';

export default function Geofences() {
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: '500' });
  const [msg, setMsg] = useState('');

  const load = () => api('/api/geofences').then(d => { setItems(d.geofences); setEvents(d.events || []); }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/geofences', { method: 'POST', body: JSON.stringify({ name: form.name, latitude: Number(form.latitude), longitude: Number(form.longitude), radius: Number(form.radius) }) });
      setForm({ name: '', latitude: '', longitude: '', radius: '500' }); setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(g => (
          <div key={g.id} className="card card-p">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Hexagon className="h-5 w-5" /></span>
              <div><p className="font-bold">{g.name}</p><p className="text-xs tabular-nums text-slate-500">{Number(g.latitude).toFixed(4)}, {Number(g.longitude).toFixed(4)} · {g.radius}m</p></div>
              <Badge tone={g.active ? 'green' : 'slate'}>{g.active ? 'Active' : 'Off'}</Badge>
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
              <span className="text-slate-500">{timeAgo(e.occurredAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
