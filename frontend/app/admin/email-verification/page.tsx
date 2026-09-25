'use client';
import { useEffect, useState } from 'react';
import { Search, Send, Check, X, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';

export default function EmailVerificationAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const d = await api(`/api/admin/users?q=${encodeURIComponent(q)}&limit=50`);
      setUsers(d.users);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, kind: 'send' | 'resend' | 'approve' | 'reject') {
    const labels = { send: 'send a verification email to', resend: 'resend the verification email to', approve: 'approve', reject: 'reject' };
    const u = users.find(x => x.id === id);
    if (!confirm(`Confirm: ${labels[kind]} ${u?.email}?`)) return;
    setBusy(id + kind); setMsg('');
    try {
      const map = {
        send: [`/api/admin/users/${id}/send-verification-email`, 'POST'],
        resend: [`/api/admin/users/${id}/resend-verification-email`, 'POST'],
        approve: [`/api/admin/users/${id}/approve`, 'PATCH'],
        reject: [`/api/admin/users/${id}/reject`, 'PATCH'],
      } as const;
      await api(map[kind][0], { method: map[kind][1] });
      setMsg(`${kind === 'send' ? 'Verification email sent' : kind === 'resend' ? 'Verification email resent' : kind === 'approve' ? 'Account approved' : 'Account rejected'} — ${u?.email}`);
      load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(null);
  }

  const shown = users.filter(u =>
    filter === 'ALL' ? true : filter === 'UNVERIFIED' ? !u.emailVerified : !u.accountApproved);

  const counts = {
    total: users.length,
    verified: users.filter(u => u.emailVerified).length,
    unverified: users.filter(u => !u.emailVerified).length,
    pending: users.filter(u => !u.accountApproved).length,
  };

  return (
    <>
      <PageHeader title="Email verification" sub="Admin-controlled verification workflow"
        actions={['ALL', 'UNVERIFIED', 'PENDING'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`badge !px-3.5 !py-2 ${filter === f ? '!bg-blue-600 !text-white' : 'badge-slate'}`}>{f}</button>
        ))} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Total users', counts.total], ['Verified', counts.verified], ['Unverified', counts.unverified], ['Pending approval', counts.pending]].map(([l, v]) => (
          <div key={l as string} className="card card-p !py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4 flex items-center gap-2 !p-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search name or email…"
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="btn !py-2" onClick={load}>Search</button>
      </div>
      {msg && <p className="card card-p mt-3 !py-3 text-sm">{msg}</p>}

      <div className="table-wrap mt-4">
        <table className="table">
          <thead><tr><th>User</th><th>Email status</th><th>Approval</th><th>Last email</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {shown.map(u => (
              <tr key={u.id}>
                <td>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email} · joined {timeAgo(u.createdAt)}</p>
                </td>
                <td><Badge tone={u.emailVerified ? 'green' : 'amber'}>{u.emailVerified ? 'Verified' : 'Unverified'}</Badge></td>
                <td><Badge tone={u.accountApproved ? 'green' : 'blue'}>{u.accountApproved ? 'Approved' : 'Pending'}</Badge></td>
                <td className="text-xs text-slate-500">
                  {u.emailLogs?.[0] ? <>{timeAgo(u.emailLogs[0].sentAt)} <Badge tone={u.emailLogs[0].status === 'SENT' ? 'green' : 'red'}>{u.emailLogs[0].status}</Badge></> : '—'}
                </td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <button title="Send verification email" disabled={busy !== null} className="btn-ghost !p-2" onClick={() => act(u.id, 'send')}><Send className="h-4 w-4" /></button>
                    <button title="Resend verification email" disabled={busy !== null} className="btn-ghost !p-2" onClick={() => act(u.id, 'resend')}><RotateCcw className="h-4 w-4" /></button>
                    <button title="Approve account" disabled={busy !== null} className="btn-ghost !p-2 !text-emerald-600" onClick={() => act(u.id, 'approve')}><Check className="h-4 w-4" /></button>
                    <button title="Reject account" disabled={busy !== null} className="btn-ghost !p-2 !text-red-600" onClick={() => act(u.id, 'reject')}><X className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title="No users match" sub="Try a different search or filter." />}
      </div>
    </>
  );
}
