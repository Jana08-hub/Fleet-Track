'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Badge, statusTone, timeAgo } from '@/components/ui';

export default function DriverDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api(`/api/drivers/${id}`).then(x => { setD(x); setStatus(x.status); }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  async function save() {
    setMsg('');
    try { await api(`/api/drivers/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setMsg('Status updated.'); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function remove() {
    if (!confirm('Delete this driver? Blocked while they have an active trip.')) return;
    setMsg('');
    try { await api(`/api/drivers/${id}`, { method: 'DELETE' }); router.push('/admin/drivers'); }
    catch (e: any) { setMsg(e.message); }
  }

  if (!d) return (<><PageHeader title="Driver" sub="Loading…" /><p className="card card-p mt-4 text-sm text-slate-500">Loading driver…</p></>);

  return (
    <>
      <PageHeader title={d.user?.name || 'Driver'} sub={`${d.user?.email || ''} · ${d.phoneNumber || ''}`}
        actions={<Link href="/admin/drivers" className="btn-ghost">← All drivers</Link>} />
      {msg && <p className="card card-p mb-4 !py-3 text-sm">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-p">
          <h2 className="font-bold">Profile</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex gap-2"><dt className="w-32 text-slate-500">License</dt><dd className="font-medium">{d.licenseNumber}</dd></div>
            <div className="flex gap-2"><dt className="w-32 text-slate-500">License expiry</dt><dd>{new Date(d.licenseExpiry).toLocaleDateString()}</dd></div>
            <div className="flex gap-2"><dt className="w-32 text-slate-500">Phone</dt><dd>{d.phoneNumber}</dd></div>
            {d.emergencyContact && <div className="flex gap-2"><dt className="w-32 text-slate-500">Emergency</dt><dd>{d.emergencyContact}</dd></div>}
            <div className="flex gap-2"><dt className="w-32 text-slate-500">Email</dt><dd><Badge tone={d.user?.emailVerified ? 'green' : 'amber'}>{d.user?.emailVerified ? 'Verified' : 'Unverified'}</Badge></dd></div>
            <div className="flex gap-2"><dt className="w-32 text-slate-500">Account</dt><dd><Badge tone={d.user?.accountApproved ? 'green' : 'blue'}>{d.user?.accountApproved ? 'Approved' : 'Pending'}</Badge></dd></div>
          </dl>
          <div className="mt-3 flex gap-2">
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {['ACTIVE', 'INACTIVE', 'ON_TRIP', 'OFFLINE'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn" onClick={save}>Save</button>
            <button className="btn-ghost !text-red-600" onClick={remove}>Delete</button>
          </div>
        </div>
        <div className="card card-p">
          <h2 className="font-bold">Trip history</h2>
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-auto text-sm">
            {(d.trips || []).map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.source} → {t.destination}</span>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                <span className="tabular-nums text-slate-500">{(t.totalDistance || 0).toFixed(1)} km</span>
                <span className="ml-auto text-xs text-slate-500">{timeAgo(t.createdAt)}</span>
              </li>
            ))}
            {(!d.trips || d.trips.length === 0) && <li className="text-slate-500">No trips yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
