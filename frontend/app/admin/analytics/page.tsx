'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { PageHeader, Stat, SkeletonCards, BarChart, Donut, last7Days } from '@/components/ui';
import { Truck, Route, Bell, Wrench } from 'lucide-react';

export default function Analytics() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api('/api/analytics/overview').then(setD).catch(() => {}); }, []);
  if (!d) return (<><PageHeader title="Analytics" sub="Fleet performance" /><SkeletonCards n={4} /></>);

  const days = last7Days();
  const tripsByDay = days.map(day => ({
    label: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    value: (d.recentTrips || []).filter((t: any) => t.createdAt.slice(0, 10) === day).length,
  }));
  const distByDay = days.map(day => ({
    label: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    value: Math.round((d.recentTrips || []).filter((t: any) => t.createdAt.slice(0, 10) === day).reduce((a: number, t: any) => a + (t.totalDistance || 0), 0)),
  }));
  const totalKm = Math.round((d.recentTrips || []).reduce((a: number, t: any) => a + (t.totalDistance || 0), 0));
  const byStatus: Record<string, number> = {};
  for (const t of d.recentTrips || []) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const colors: Record<string, string> = { ACTIVE: '#2563eb', COMPLETED: '#16a34a', PLANNED: '#94a3b8', CANCELLED: '#dc2626', DELAYED: '#f59e0b' };
  const donut = Object.entries(byStatus).map(([label, value]) => ({ label, value, color: colors[label] || '#64748b' }));

  return (
    <>
      <PageHeader title="Analytics" sub="Performance across the fleet"
        actions={<a className="btn-ghost" href={`${API_URL}/api/analytics/export/trips.csv`}><Download className="h-4 w-4" /> Trips CSV</a>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total trips" value={d.activeTrips + d.completedTrips} icon={<Route className="h-5 w-5" />} />
        <Stat label="Distance (sample)" value={`${totalKm} km`} icon={<Truck className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" hint="last 500 trips" />
        <Stat label="Open alerts" value={d.alerts} icon={<Bell className="h-5 w-5" />} tone="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" />
        <Stat label="Maintenance due" value={d.maintenanceDue} icon={<Wrench className="h-5 w-5" />} tone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" hint="next 7 days" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card card-p">
          <h2 className="font-bold">Trips per day</h2>
          <div className="mt-3 text-slate-700 dark:text-slate-200"><BarChart data={tripsByDay} /></div>
        </div>
        <div className="card card-p">
          <h2 className="font-bold">Distance per day (km)</h2>
          <div className="mt-3 text-slate-700 dark:text-slate-200"><BarChart data={distByDay} /></div>
        </div>
      </div>
      <div className="card card-p mt-4">
        <h2 className="font-bold">Trips by status</h2>
        <div className="mt-3 text-slate-700 dark:text-slate-200">
          {donut.length ? <Donut segments={donut} size={170} /> : 'No trip data yet.'}
        </div>
      </div>
    </>
  );
}
