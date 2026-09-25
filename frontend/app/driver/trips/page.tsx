'use client';
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Empty, statusTone, timeAgo } from '@/components/ui';

export default function DriverTrips() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api('/api/trips').then(d => setItems(d.trips || [])).catch(() => {}); }, []);
  return (
    <>
      <h1 className="page-title">My trips</h1>
      <p className="page-sub">{items.length} trips on record</p>
      <div className="mt-4 grid gap-3">
        {items.map(t => (
          <div key={t.id} className="card card-p !py-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-400" />
              <p className="font-semibold">{t.source} → {t.destination}</p>
              <span className="ml-auto"><Badge tone={statusTone(t.status)}>{t.status}</Badge></span>
            </div>
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              {(t.totalDistance || 0).toFixed(1)} km
              {t.averageSpeed ? ` · ${t.averageSpeed.toFixed(0)} km/h avg` : ''} · {timeAgo(t.createdAt)}
            </p>
          </div>
        ))}
        {items.length === 0 && <div className="card"><Empty title="No trips yet" sub="Assigned trips will show up here." /></div>}
      </div>
    </>
  );
}
