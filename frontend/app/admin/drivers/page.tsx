'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, CircleUserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, statusTone } from '@/components/ui';

export default function Drivers() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', licenseNumber: '', licenseExpiry: '', phoneNumber: '' });
  const [msg, setMsg] = useState('');

  const load = () => api('/api/drivers').then(d => setItems(d.drivers)).catch(() => {});
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => items.filter(d =>
    `${d.user?.name || ''} ${d.user?.email || ''} ${d.licenseNumber}`.toLowerCase().includes(q.toLowerCase())), [items, q]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/drivers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '', licenseNumber: '', licenseExpiry: '', phoneNumber: '' });
      setShowForm(false); setMsg('Driver created. Send them a verification email from Email Verification.'); load();
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <>
      <PageHeader title="Drivers" sub={`${items.length} drivers registered`}
        actions={<button className="btn" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4" /> Add driver</button>} />
      {msg && <p className="card card-p mb-4 !py-3 text-sm">{msg}</p>}

      {showForm && (
        <form onSubmit={create} className="card card-p mb-4 grid gap-3 sm:grid-cols-3">
          {[['name', 'Full name', 'text'], ['email', 'Email', 'email'], ['password', 'Temp password (min 8)', 'password'], ['licenseNumber', 'License number', 'text'], ['licenseExpiry', 'License expiry', 'date'], ['phoneNumber', 'Phone number', 'tel']].map(([k, ph, type]) => (
            <div key={k}><label className="label">{ph}</label>
              <input className="input" type={type} required value={(form as any)[k]}
                onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div className="sm:col-span-3 flex gap-2">
            <button className="btn">Save driver</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card mb-4 flex items-center gap-2 !p-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search name, email, license…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Driver</th><th>License</th><th>Status</th><th>Verified</th><th>Account</th></tr></thead>
          <tbody>
            {shown.map((d: any) => (
              <tr key={d.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><CircleUserRound className="h-5 w-5" /></span>
                    <div><p className="font-semibold"><Link href={`/admin/drivers/${d.id}`} className="text-blue-600 hover:underline">{d.user?.name}</Link></p><p className="text-xs text-slate-500">{d.user?.email} · {d.phoneNumber}</p></div>
                  </div>
                </td>
                <td className="text-slate-500">{d.licenseNumber}</td>
                <td><Badge tone={statusTone(d.status)}>{d.status}</Badge></td>
                <td><Badge tone={d.user?.emailVerified ? 'green' : 'amber'}>{d.user?.emailVerified ? 'Verified' : 'Unverified'}</Badge></td>
                <td><Badge tone={d.user?.accountApproved ? 'green' : 'blue'}>{d.user?.accountApproved ? 'Approved' : 'Pending'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title="No drivers found" sub="Add your first driver above." />}
      </div>
    </>
  );
}
