'use client';
import { useEffect, useState } from 'react';
import { api, API_URL, SOCKET_URL } from '@/lib/api';
import { PageHeader, Badge } from '@/components/ui';

export default function Settings() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [sim, setSim] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [dueMsg, setDueMsg] = useState('');

  useEffect(() => {
    api('/api/auth/me').then(u => { setMe(u); setName(u.name); }).catch(() => {});
    api('/api/admin/simulate/status').then(setSim).catch(() => {});
    fetch(`${API_URL}/health`).then(r => r.json()).then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      const body: any = {};
      if (name && name !== me?.name) body.name = name;
      if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }
      const r = await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
      setMsg(r.message || 'Saved.');
      setCurrentPassword(''); setNewPassword('');
      setMe({ ...me, name: body.name || me?.name });
    } catch (e: any) { setMsg(e.message); }
  }

  async function toggleSim() {
    setDueMsg('');
    try {
      if (sim?.running) await api('/api/admin/simulate/stop', { method: 'POST' });
      else await api('/api/admin/simulate/start', { method: 'POST' });
      setSim(await api('/api/admin/simulate/status'));
    } catch (e: any) { setDueMsg(e.message); }
  }

  async function runDue() {
    setDueMsg('');
    try {
      const r = await api('/api/admin/maintenance/check-due', { method: 'POST' });
      setDueMsg(`Expiry check finished — ${r.created} alert${r.created === 1 ? '' : 's'} created.`);
    } catch (e: any) { setDueMsg(e.message); }
  }

  return (
    <>
      <PageHeader title="Settings" sub="Account, fleet operations and system status" />

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card card-p">
          <h2 className="font-bold">My account</h2>
          <p className="mt-1 text-sm text-slate-500">{me?.email} · {me?.role}</p>
          <div className="mt-3"><label className="label">Display name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} /></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Current password</label>
              <input className="input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" /></div>
            <div><label className="label">New password (min 8)</label>
              <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" /></div>
          </div>
          <button className="btn mt-3">Save changes</button>
          {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
        </form>

        <div className="card card-p">
          <h2 className="font-bold">Fleet operations</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={sim?.running ? 'amber' : 'slate'}>{sim?.running ? 'DEMO running' : 'Simulation off'}</Badge>
            <button type="button" className="btn !py-1.5 text-xs" onClick={toggleSim}>{sim?.running ? 'Stop demo' : 'Start demo'}</button>
            <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={runDue}>Run expiry check now</button>
          </div>
          {dueMsg && <p className="mt-2 text-sm text-slate-600">{dueMsg}</p>}
          <p className="mt-3 text-xs text-slate-500">Demo movement is always labeled DEMO and never stored as real GPS without the simulated flag. Expiry checks create insurance, pollution, license and service-due alerts.</p>
        </div>
      </div>

      <div className="card card-p mt-4">
        <h2 className="font-bold">System</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex gap-2"><dt className="w-36 text-slate-500">Backend</dt><dd className="break-all">{API_URL} · <Badge tone={health?.ok ? 'green' : 'red'}>{health?.ok ? 'reachable' : 'unreachable'}</Badge></dd></div>
          <div className="flex gap-2"><dt className="w-36 text-slate-500">Socket.IO</dt><dd className="break-all">{SOCKET_URL}</dd></div>
          <div className="flex gap-2"><dt className="w-36 text-slate-500">Map tiles</dt><dd className="break-all">{process.env.NEXT_PUBLIC_MAP_TILE_URL || 'OpenStreetMap default'}</dd></div>
        </dl>
      </div>
    </>
  );
}
