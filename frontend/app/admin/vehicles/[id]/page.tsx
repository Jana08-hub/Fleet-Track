'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, statusTone, timeAgo } from '@/components/ui';

export default function VehicleDetails() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [tripFilter, setTripFilter] = useState('');
  const [assignId, setAssignId] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    api(`/api/vehicles/${id}`).then(d => { setV(d); setStatus(d.status); }).catch(() => {});
    api(`/api/vehicles/${id}/assignments`).then(d => setAssignments(d.assignments || [])).catch(() => {});
  };
  const loadHistory = (tripId = tripFilter) => {
    const params = new URLSearchParams({ limit: '200' });
    if (tripId) params.set('tripId', tripId);
    api(`/api/gps/vehicles/${id}/history?${params}`).then(d => setHistory(d.points || [])).catch(() => {});
  };
  useEffect(() => {
    load(); loadHistory('');
    api('/api/drivers').then(d => setDrivers(d.drivers || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveStatus() {
    setMsg('');
    try { await api(`/api/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setMsg('Status updated.'); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function assign() {
    if (!assignId) return;
    setMsg('');
    try { await api(`/api/vehicles/${id}/assign`, { method: 'POST', body: JSON.stringify({ driverId: assignId }) }); setAssignId(''); setMsg('Driver assigned.'); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function unassign() {
    if (!confirm('Unassign the current driver?')) return;
    await api(`/api/vehicles/${id}/assign`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  if (!v) return (<><PageHeader title="Vehicle" sub="Loading…" /><p className="card card-p mt-4 text-sm text-slate-500">Loading vehicle…</p></>);

  return (
    <>
      <PageHeader title={v.registrationNumber} sub={`${v.brand} ${v.model} · ${v.manufacturingYear} · ${v.fuelType}`}
        actions={<Link href="/admin/vehicles" className="btn-ghost">← All vehicles</Link>} />
      {msg && <p className="card card-p mb-4 !py-3 text-sm">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-p">
          <h2 className="font-bold">Status & assignment</h2>
          <p className="mt-2 text-sm"><Badge tone={statusTone(v.status)}>{v.status}</Badge> · {Number(v.mileage || 0).toFixed(0)} km · last seen {timeAgo(v.lastSeenAt)}</p>
          <div className="mt-3 flex gap-2">
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {['ACTIVE', 'INACTIVE', 'IN_TRIP', 'MAINTENANCE', 'OFFLINE'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn" onClick={saveStatus}>Save</button>
          </div>
          <div className="mt-4 flex gap-2">
            <select className="input" value={assignId} onChange={e => setAssignId(e.target.value)}>
              <option value="">Select driver…</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.user?.name} ({d.user?.email})</option>)}
            </select>
            <button className="btn" onClick={assign} disabled={!assignId}>Assign</button>
            <button className="btn-ghost" onClick={unassign}>Unassign</button>
          </div>
          <h3 className="mt-4 font-bold">Assignment history</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assignments.map((a: any) => (
              <li key={a.id} className="flex flex-wrap gap-2">
                <span className="font-medium">{a.driver?.user?.name || a.driverId}</span>
                <Badge tone={a.active ? 'green' : 'slate'}>{a.active ? 'Active' : 'Ended'}</Badge>
                <span className="text-slate-500">{timeAgo(a.assignedAt)}</span>
              </li>
            ))}
            {assignments.length === 0 && <li className="text-slate-500">No assignments yet.</li>}
          </ul>
        </div>

        <div className="card card-p">
          <h2 className="font-bold">Location history</h2>
          <div className="mt-2 flex gap-2">
            <select className="input" value={tripFilter} onChange={e => { setTripFilter(e.target.value); loadHistory(e.target.value); }}>
              <option value="">All trips (latest 200)</option>
              {(v.trips || []).map((t: any) => <option key={t.id} value={t.id}>{t.source} → {t.destination} ({t.status})</option>)}
            </select>
          </div>
          <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-sm tabular-nums">
            {history.map((p: any) => (
              <li key={p.id} className="flex gap-2">
                <span>{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}</span>
                {p.speed != null && <span className="text-slate-500">{Number(p.speed).toFixed(0)} km/h</span>}
                {p.isSimulated && <Badge tone="amber">DEMO</Badge>}
                <span className="ml-auto text-xs text-slate-500">{timeAgo(p.serverTimestamp)}</span>
              </li>
            ))}
            {history.length === 0 && <li className="text-slate-500">No GPS points yet — not live.</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-p mt-4">
          <h2 className="font-bold">Recent trips</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(v.trips || []).map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.source} → {t.destination}</span>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                <span className="tabular-nums text-slate-500">{(t.totalDistance || 0).toFixed(1)} km</span>
              </li>
            ))}
            {(!v.trips || v.trips.length === 0) && <li className="text-slate-500">No trips.</li>}
          </ul>
        </div>
        <div className="card card-p mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Maintenance</h2>
            <Link href="/admin/maintenance" className="text-sm font-semibold text-blue-600 hover:underline">Manage</Link>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(v.maintenance || []).map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.serviceType}</span>
                <span className="text-slate-500">{new Date(m.serviceDate).toLocaleDateString()} · ₹{Number(m.cost || 0).toFixed(0)}</span>
              </li>
            ))}
            {(!v.maintenance || v.maintenance.length === 0) && <li className="text-slate-500">No records.</li>}
          </ul>
        </div>
      </div>
      {v.insuranceExpiry && <p className="mt-4 text-sm text-slate-500">Insurance expires {new Date(v.insuranceExpiry).toLocaleDateString()} · Pollution {v.pollutionExpiry ? new Date(v.pollutionExpiry).toLocaleDateString() : '—'}</p>}
    </>
  );
}
