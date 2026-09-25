'use client';
import { useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Empty, timeAgo } from '@/components/ui';

export default function Maintenance() {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', serviceType: 'General Service', description: '', serviceDate: new Date().toISOString().slice(0, 10), cost: 0, currentMileage: 0, notes: '' });
  const [msg, setMsg] = useState('');

  const load = () => api('/api/maintenance').then(d => setItems(d.records)).catch(() => {});
  useEffect(() => {
    load();
    api('/api/vehicles').then(d => setVehicles(d.vehicles)).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/maintenance', { method: 'POST', body: JSON.stringify({ ...form, cost: Number(form.cost), currentMileage: Number(form.currentMileage) }) });
      setShowForm(false); load();
    } catch (e: any) { setMsg(e.message); }
  }

  const totalCost = items.reduce((a, r) => a + (r.cost || 0), 0);

  return (
    <>
      <PageHeader title="Maintenance" sub={`${items.length} records · ₹${totalCost.toLocaleString('en-IN')} total spend`}
        actions={<button className="btn" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4" /> Add record</button>} />

      {showForm && (
        <form onSubmit={create} className="card card-p mb-4 grid gap-3 sm:grid-cols-3">
          <div><label className="label">Vehicle</label>
            <select className="input" required value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select…</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber}</option>)}
            </select></div>
          <div><label className="label">Service type</label>
            <select className="input" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })}>
              {['General Service', 'Oil Change', 'Tyres', 'Brakes', 'Battery', 'Insurance', 'Repair', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">Service date</label>
            <input className="input" type="date" required value={form.serviceDate} onChange={e => setForm({ ...form, serviceDate: e.target.value })} /></div>
          <div className="sm:col-span-3"><label className="label">Description</label>
            <input className="input" required placeholder="What was done?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Cost (₹)</label>
            <input className="input" type="number" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
          <div><label className="label">Odometer (km)</label>
            <input className="input" type="number" min="0" value={form.currentMileage} onChange={e => setForm({ ...form, currentMileage: Number(e.target.value) })} /></div>
          <div><label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <button className="btn">Save record</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Service</th><th>Description</th><th>Date</th><th>Cost</th><th>Next due</th></tr></thead>
          <tbody>
            {items.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"><Wrench className="h-4 w-4" /></span>
                    <span className="font-semibold">{r.serviceType}</span>
                  </div>
                </td>
                <td className="max-w-[260px] truncate text-slate-500">{r.description}</td>
                <td className="text-slate-500">{timeAgo(r.serviceDate)}</td>
                <td className="font-semibold tabular-nums">₹{Number(r.cost || 0).toLocaleString('en-IN')}</td>
                <td className="text-slate-500">{r.nextServiceDate ? timeAgo(r.nextServiceDate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty title="No maintenance records" sub="Add your first service record above." />}
      </div>
    </>
  );
}
