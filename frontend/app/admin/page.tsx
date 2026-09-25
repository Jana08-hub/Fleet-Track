'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, Users, Route, Bell, MailWarning, UserCheck, Wrench, Radio, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Stat, Badge, PageHeader, SkeletonCards, Empty, BarChart, Donut, statusTone, timeAgo, last7Days } from '@/components/ui';

export default function AdminDash() {
  const [d, setD] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    api('/api/analytics/overview').then(setD).catch(() => {});
    api('/api/vehicles').then(v => setVehicles(v.vehicles)).catch(() => {});
    api('/api/alerts').then(a => setAlerts((a.alerts || []).filter((x: any) => !x.isResolved).slice(0, 6))).catch(() => {});
    api('/api/trips').then(t => setTrips((t.trips || []).slice(0, 8))).catch(() => {});
  }, []);

  if (!d) return (<><PageHeader title="Dashboard" sub="Fleet overview" /><SkeletonCards n={8} /></>);

  const online = vehicles.filter(v => v.lastSeenAt && Date.now() - new Date(v.lastSeenAt).getTime() < 120_000).length;
  const days = last7Days();
  const tripsByDay = days.map(day => ({
    label: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    value: (d.recentTrips || []).filter((t: any) => t.createdAt.slice(0, 10) === day).length,
  }));
  const distByDay = days.map(day => ({
    label: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    value: Math.round((d.recentTrips || []).filter((t: any) => t.createdAt.slice(0, 10) === day).reduce((a: number, t: any) => a + (t.totalDistance || 0), 0)),
  }));
  const byStatus: Record<string, number> = {};
  for (const t of d.recentTrips || []) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const donutColors: Record<string, string> = { ACTIVE: '#2563eb', COMPLETED: '#16a34a', PLANNED: '#94a3b8', CANCELLED: '#dc2626', DELAYED: '#f59e0b' };
  const donut = Object.entries(byStatus).map(([label, value]) => ({ label, value, color: donutColors[label] || '#64748b' }));

  return (
    <>
      <PageHeader title="Dashboard" sub={`Welcome back — ${online} of ${d.vehicles} vehicles online right now.`}
        actions={<><Link href="/admin/live-tracking" className="btn">Live map <ArrowRight className="h-4 w-4" /></Link><Link href="/admin/email-verification" className="btn-ghost">Verify users</Link></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vehicles" value={d.vehicles} icon={<Truck className="h-5 w-5" />} hint={`${online} online`} />
        <Stat label="Drivers" value={d.drivers} icon={<Users className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <Stat label="Active trips" value={d.activeTrips} icon={<Route className="h-5 w-5" />} tone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" hint={`${d.completedTrips} completed`} />
        <Stat label="Open alerts" value={d.alerts} icon={<Bell className="h-5 w-5" />} tone="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" />
        <Stat label="Unverified users" value={d.unverified} icon={<MailWarning className="h-5 w-5" />} tone="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" />
        <Stat label="Pending approval" value={d.pending} icon={<UserCheck className="h-5 w-5" />} tone="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" />
        <Stat label="Maintenance due" value={d.maintenanceDue} icon={<Wrench className="h-5 w-5" />} tone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" hint="next 7 days" />
        <Stat label="Live signal" value={`${online}/${d.vehicles}`} icon={<Radio className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" hint="seen in last 2 min" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card card-p lg:col-span-3">
          <h2 className="font-bold">Trips — last 7 days</h2>
          <div className="mt-3 text-slate-700 dark:text-slate-200"><BarChart data={tripsByDay} /></div>
        </div>
        <div className="card card-p lg:col-span-2">
          <h2 className="font-bold">Trips by status</h2>
          <div className="mt-3 text-slate-700 dark:text-slate-200">
            {donut.length ? <Donut segments={donut} /> : <Empty title="No trips yet" sub="Create one from the Trips page." />}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card card-p">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Distance per day (km)</h2>
            <Link href="/admin/analytics" className="text-sm font-semibold text-blue-600 hover:underline">Full analytics</Link>
          </div>
          <div className="text-slate-700 dark:text-slate-200"><BarChart data={distByDay} height={120} /></div>
        </div>
        <div className="card card-p">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Latest open alerts</h2>
            <Link href="/admin/alerts" className="text-sm font-semibold text-blue-600 hover:underline">All alerts</Link>
          </div>
          {alerts.length === 0 && <Empty title="All clear" sub="No unresolved alerts." />}
          <ul className="space-y-2">
            {alerts.map(a => (
              <li key={a.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-sm dark:bg-slate-800">
                <Badge tone={a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'red' : 'amber'}>{a.severity}</Badge>
                <span className="min-w-0 flex-1 truncate">{a.message}</span>
                <span className="shrink-0 text-xs text-slate-500">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-bold">Recent trips</h2>
          <Link href="/admin/trips" className="text-sm font-semibold text-blue-600 hover:underline">Manage trips</Link>
        </div>
        <div className="table-wrap !rounded-none !border-0">
          <table className="table">
            <thead><tr><th>Route</th><th>Vehicle</th><th>Status</th><th>Distance</th><th>Created</th></tr></thead>
            <tbody>
              {trips.map((t: any) => (
                <tr key={t.id}>
                  <td className="max-w-[240px] truncate font-medium">{t.source} → {t.destination}</td>
                  <td className="text-slate-500">{t.vehicle?.registrationNumber || '—'}</td>
                  <td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                  <td className="tabular-nums">{(t.totalDistance || 0).toFixed(1)} km</td>
                  <td className="text-slate-500">{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trips.length === 0 && <Empty title="No trips yet" sub="Create one from the Trips page." />}
        </div>
      </div>
    </>
  );
}
