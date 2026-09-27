'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';

export default function Alerts() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('OPEN');
  const [severity, setSeverity] = useState('ALL');
  const [type, setType] = useState('ALL');
  const load = () => api('/api/alerts').then(d => setItems(d.alerts)).catch(() => {});
  useEffect(() => { load(); }, []);

  const types = useMemo(() => Array.from(new Set(items.map(a => a.alertType))).sort(), [items]);
  const shown = useMemo(() => items.filter(a =>
    (filter === 'ALL' ? true : filter === 'OPEN' ? !a.isResolved : a.isResolved) &&
    (severity === 'ALL' || a.severity === severity) &&
    (type === 'ALL' || a.alertType === type)), [items, filter, severity, type]);

  async function resolve(id: string) {
    await api(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
    load();
  }
  async function markRead(id: string) {
    await api(`/api/alerts/${id}/read`, { method: 'PATCH' });
    load();
  }

  const sevTone = (s: string) => s === 'CRITICAL' || s === 'HIGH' ? 'red' : s === 'MEDIUM' ? 'amber' : 'slate';

  return (
    <>
      <PageHeader title="Alerts" sub={`${items.filter(a => !a.isResolved).length} open · ${items.length} total`}
        actions={['ALL', 'OPEN', 'RESOLVED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`badge !px-3.5 !py-2 ${filter === f ? '!bg-blue-600 !text-white' : 'badge-slate'}`}>{f}</button>
        ))} />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="input max-w-[180px] !py-2" value={severity} onChange={e => setSeverity(e.target.value)}>
          {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s === 'ALL' ? 'All severities' : s}</option>)}
        </select>
        <select className="input max-w-[220px] !py-2" value={type} onChange={e => setType(e.target.value)}>
          <option value="ALL">All types</option>
          {types.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      <div className="grid gap-3">
        {shown.map((a: any) => (
          <div key={a.id} className={`card card-p !py-4 ${a.isResolved ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={sevTone(a.severity)}>{a.severity}</Badge>
              <Badge tone="slate">{a.alertType.replaceAll('_', ' ')}</Badge>
              {a.isResolved && <Badge tone="green">Resolved</Badge>}
              <span className="ml-auto text-xs text-slate-500">{timeAgo(a.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm">{a.message}</p>
            {!a.isResolved && (
              <div className="mt-3 flex gap-2">
                {!a.isRead && <button className="btn-ghost !py-1.5 text-xs" onClick={() => markRead(a.id)}>Mark read</button>}
                <button className="btn-ghost !py-1.5 text-xs" onClick={() => resolve(a.id)}>
                  <CheckCheck className="h-4 w-4" /> Mark resolved
                </button>
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <div className="card"><Empty title={filter === 'OPEN' ? 'All clear' : 'No alerts here'} sub="New alerts arrive in real time." /></div>}
      </div>
    </>
  );
}
