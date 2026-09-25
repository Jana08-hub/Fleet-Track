'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, statusTone, timeAgo } from '@/components/ui';

const EMPTY_FORM = { registrationNumber: '', vehicleType: 'Truck', brand: '', model: '', manufacturingYear: new Date().getFullYear(), fuelType: 'Diesel', mileage: 0 };

export default function Vehicles() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [msg, setMsg] = useState('');

  const load = () => api('/api/vehicles').then(d => setItems(d.vehicles)).catch(() => {});
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => items.filter(v =>
    `${v.registrationNumber} ${v.brand} ${v.model}`.toLowerCase().includes(q.toLowerCase())), [items, q]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/vehicles', { method: 'POST', body: JSON.stringify({ ...form, manufacturingYear: Number(form.manufacturingYear), mileage: Number(form.mileage) }) });
      setForm(EMPTY_FORM); setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <>
      <PageHeader title="Vehicles" sub={`${items.length} vehicles in the fleet`}
        actions={<button className="btn" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4" /> Add vehicle</button>} />

      {showForm && (
        <form onSubmit={create} className="card card-p mb-4 grid gap-3 sm:grid-cols-3">
          {[['registrationNumber', 'Registration no.'], ['brand', 'Brand'], ['model', 'Model']].map(([k, ph]) => (
            <div key={k}><label className="label">{ph}</label>
              <input className="input" required value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div><label className="label">Type</label>
            <select className="input" value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}>
              {['Truck', 'Van', 'Car', 'Bus', 'Bike', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">Year</label>
            <input className="input" type="number" value={form.manufacturingYear} onChange={e => setForm({ ...form, manufacturingYear: e.target.value })} /></div>
          <div><label className="label">Fuel</label>
            <select className="input" value={form.fuelType} onChange={e => setForm({ ...form, fuelType: e.target.value })}>
              {['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid'].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <button className="btn">Save vehicle</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className="card mb-4 flex items-center gap-2 !p-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search registration, brand, model…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Vehicle</th><th>Type</th><th>Status</th><th>Mileage</th><th>Last seen</th></tr></thead>
          <tbody>
            {shown.map(v => (
              <tr key={v.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><Truck className="h-4 w-4 text-slate-500" /></span>
                    <div><p className="font-semibold">{v.registrationNumber}</p><p className="text-xs text-slate-500">{v.brand} {v.model} · {v.manufacturingYear}</p></div>
                  </div>
                </td>
                <td className="text-slate-500">{v.vehicleType}</td>
                <td><Badge tone={statusTone(v.status)}>{v.status}</Badge></td>
                <td className="tabular-nums">{Number(v.mileage || 0).toFixed(0)} km</td>
                <td className="text-slate-500">{timeAgo(v.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title="No vehicles found" sub={q ? 'Try a different search.' : 'Add your first vehicle above.'} />}
      </div>
    </>
  );
}
