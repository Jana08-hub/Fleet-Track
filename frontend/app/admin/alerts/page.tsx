'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Badge, Empty, timeAgo } from '@/components/ui';

export default function Alerts() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('OPEN');
  const load = () => api('/api/alerts').then(d => setItems(d.alerts)).catch(() => {});
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => items.filter(a =>
    filter === 'ALL' ? true : filter === 'OPEN' ? !a.isResolved : a.isResolved), [items, filter]);

  async function resolve(id: string) {
    await api(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
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
              <button className="btn-ghost mt-3 !py-1.5 text-xs" onClick={() => resolve(a.id)}>
                <CheckCheck className="h-4 w-4" /> Mark resolved
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <div className="card"><Empty title={filter === 'OPEN' ? 'All clear' : 'No alerts here'} sub="New alerts arrive in real time." /></div>}
      </div>
    </>
  );
}
