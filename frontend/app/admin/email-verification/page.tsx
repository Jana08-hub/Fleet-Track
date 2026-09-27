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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const limit = 20;

  async function load(p = page, status = filter, query = q) {
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (query) params.set('q', query);
      if (status === 'UNVERIFIED' || status === 'PENDING') params.set('status', status === 'UNVERIFIED' ? 'unverified' : 'pending');
      const d = await api(`/api/admin/users?${params}`);
      setUsers(d.users || []); setTotal(d.total ?? (d.users || []).length);
    } catch {}
  }
  useEffect(() => { load(1, filter, q); setPage(1); setSelected(new Set()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

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

  async function bulkApprove() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Approve ${ids.length} account${ids.length === 1 ? '' : 's'}?`)) return;
    setBusy('bulk'); setMsg('');
    try {
      const r = await api('/api/admin/users/bulk-approve', { method: 'POST', body: JSON.stringify({ ids }) });
      setMsg(`Approved ${r.approved} account${r.approved === 1 ? '' : 's'}.`);
      setSelected(new Set()); load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(null);
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const shown = users;
  const pages = Math.max(1, Math.ceil(total / limit));

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
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1, filter, (e.target as HTMLInputElement).value))} />
        <button className="btn !py-2" onClick={() => { setPage(1); load(1, filter, q); }}>Search</button>
        {selected.size > 0 && <button className="btn !py-2" disabled={busy !== null} onClick={bulkApprove}>Approve {selected.size}</button>}
      </div>
      {msg && <p className="card card-p mt-3 !py-3 text-sm">{msg}</p>}

      <div className="table-wrap mt-4">
        <table className="table">
          <thead><tr><th><input type="checkbox" checked={shown.length > 0 && shown.every(u => selected.has(u.id))}
            onChange={e => setSelected(e.target.checked ? new Set(shown.map(u => u.id)) : new Set())} /></th><th>User</th><th>Email status</th><th>Approval</th><th>Last email</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {shown.map(u => (
              <tr key={u.id}>
                <td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
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
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}>← Prev</button>
          <span className="text-slate-500">Page {page} of {pages} ({total} users)</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); load(p); }}>Next →</button>
        </div>
      )}
    </>
  );
}
