'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Map, Truck, Users, Route, Hexagon, Bell, Wrench,
  BarChart3, MailCheck, Settings, LogOut, Menu, X, Moon, Sun,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { api } from '@/lib/api';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/live-tracking', label: 'Live Tracking', icon: Map },
  { href: '/admin/trips', label: 'Trips', icon: Route },
  { href: '/admin/vehicles', label: 'Vehicles', icon: Truck },
  { href: '/admin/drivers', label: 'Drivers', icon: Users },
  { href: '/admin/geofences', label: 'Geofences', icon: Hexagon },
  { href: '/admin/alerts', label: 'Alerts', icon: Bell },
  { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/email-verification', label: 'Email Verification', icon: MailCheck },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/api/auth/me')
      .then(u => {
        if (u.role !== 'ADMIN') router.replace('/driver');
        else { setMe(u); setChecking(false); }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_role');
    router.push('/login');
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="skeleton shimmer h-8 w-56" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="card card-p"><div className="skeleton h-4 w-1/2" /><div className="skeleton mt-3 h-8 w-2/3" /></div>)}
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1" onClick={() => setOpen(false)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">F</span>
        <span className="text-lg font-bold tracking-tight">FleetTrack</span>
      </Link>
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
        {NAV.map(n => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`side-link ${active ? 'active' : ''}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
        <p className="truncate text-sm font-semibold">{me?.name}</p>
        <p className="truncate text-xs text-slate-500">{me?.email}</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost flex-1 !px-2 !py-1.5 text-xs" onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Theme
          </button>
          <button className="btn-ghost flex-1 !px-2 !py-1.5 text-xs" onClick={logout}>
            <LogOut className="h-4 w-4" /> Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-xl dark:bg-slate-900">
            <button className="btn-ghost mb-3 !p-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 lg:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <button className="btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="font-bold">FleetTrack</span>
          </div>
        </div>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
