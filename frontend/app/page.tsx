import Link from 'next/link';
import { Truck, Map, Bell, BarChart3, ShieldCheck, Smartphone, ArrowRight, Moon, Sun } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const FEATURES = [
  { icon: Map, title: 'Live GPS tracking', text: 'Every vehicle on one map, updating in real time over WebSockets — no hardware trackers needed.' },
  { icon: Smartphone, title: 'Phone-as-tracker', text: 'Drivers share location straight from their mobile browser while a trip is active.' },
  { icon: Bell, title: 'Geofences & alerts', text: 'Depot zones, overspeed, offline and maintenance alerts the moment something happens.' },
  { icon: BarChart3, title: 'Fleet analytics', text: 'Distance, utilization, trip history and costs with CSV export for reporting.' },
  { icon: ShieldCheck, title: 'Secure by default', text: 'Verified emails, admin approvals, role-based access and full audit logs.' },
  { icon: Truck, title: 'Trips & maintenance', text: 'Assignments, trip lifecycle with Haversine distance, service schedules and costs.' },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">F</span>
          <span className="text-lg font-bold tracking-tight">FleetTrack</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn-ghost !py-2">Log in</Link>
            <Link href="/register" className="btn !py-2">Get started <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:pt-20">
          <span className="badge badge-blue">Real-time fleet monitoring · No hardware needed</span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Know where every vehicle is. <span className="text-blue-600">Live.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            FleetTrack turns drivers&apos; smartphones into GPS trackers and puts the whole fleet —
            trips, geofences, alerts and analytics — on one clean dashboard.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn !px-6 !py-3">Start tracking free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/admin/live-tracking" className="btn-ghost !px-6 !py-3">View live demo map</Link>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3">
            {[['3s', 'GPS refresh'], ['24/7', 'Trip coverage'], ['100%', 'OpenStreetMap']].map(([v, l]) => (
              <div key={l} className="card card-p !p-4">
                <p className="text-2xl font-extrabold text-blue-600">{v}</p>
                <p className="text-xs font-medium text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-center text-2xl font-bold tracking-tight">Everything a fleet manager needs</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(f => (
                <div key={f.title} className="card card-p">
                  <span className="stat-icon bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><f.icon className="h-5 w-5" /></span>
                  <h3 className="mt-3 font-bold">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight">How it works</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[['1', 'Register the fleet', 'Add vehicles, drivers and assign them in minutes.'], ['2', 'Driver starts a trip', 'They open the tracking page on their phone and tap Start.'], ['3', 'Watch it live', 'Locations stream to your dashboard with alerts and history.']].map(([n, t, d]) => (
              <div key={n} className="card card-p text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{n}</span>
                <h3 className="mt-3 font-bold">{t}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/register" className="btn !px-6 !py-3">Create your account <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-6 text-sm text-slate-500">
          <span className="font-bold text-slate-700 dark:text-slate-200">FleetTrack</span>
          <span>· Real-time fleet monitoring</span>
          <span className="ml-auto">Maps © OpenStreetMap contributors</span>
        </div>
      </footer>
    </div>
  );
}
