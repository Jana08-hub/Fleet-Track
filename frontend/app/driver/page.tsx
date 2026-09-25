'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navigation, Route, Truck, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Empty, statusTone, timeAgo } from '@/components/ui';

export default function DriverDash() {
  const [me, setMe] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    api('/api/auth/me').then(setMe).catch(() => {});
    api('/api/trips').then(d => setTrips(d.trips || [])).catch(() => {});
  }, []);

  const mine = trips.filter(t => t.driverId === me?.driverProfile?.id);
  const active = mine.find(t => t.status === 'ACTIVE');

  return (
    <>
      <h1 className="page-title">Hi, {me?.name?.split(' ')[0] || 'driver'}</h1>
      <p className="page-sub">Ready for your next trip?</p>

      {active ? (
        <Link href="/driver/tracking" className="card card-p mt-4 flex items-center gap-3 border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <span className="stat-icon bg-blue-600 text-white"><Navigation className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Trip in progress</p>
            <p className="font-bold">{active.source} → {active.destination}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-blue-600" />
        </Link>
      ) : (
        <Link href="/driver/tracking" className="btn mt-4 w-full !py-4 text-base"><Navigation className="h-5 w-5" /> Open GPS tracking</Link>
      )}

      <h2 className="mb-2 mt-6 flex items-center gap-2 font-bold"><Route className="h-4 w-4" /> My trips ({mine.length})</h2>
      <div className="grid gap-3">
        {mine.slice(0, 10).map(t => (
          <div key={t.id} className="card card-p !py-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-400" />
              <p className="font-semibold">{t.source} → {t.destination}</p>
              <span className="ml-auto"><Badge tone={statusTone(t.status)}>{t.status}</Badge></span>
            </div>
            <p className="mt-1 text-xs tabular-nums text-slate-500">{(t.totalDistance || 0).toFixed(1)} km · {timeAgo(t.createdAt)}</p>
          </div>
        ))}
        {mine.length === 0 && <div className="card"><Empty title="No trips assigned yet" sub="Your dispatcher will assign trips here." /></div>}
      </div>
    </>
  );
}
