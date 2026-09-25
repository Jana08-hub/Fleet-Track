'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Navigation, Route, LogOut, Moon, Sun, Truck } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { api } from '@/lib/api';

const NAV = [
  { href: '/driver', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/driver/tracking', label: 'Tracking', icon: Navigation },
  { href: '/driver/trips', label: 'Trips', icon: Route },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [me, setMe] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/api/auth/me')
      .then(u => {
        if (u.role !== 'DRIVER') router.replace('/admin');
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
    return <div className="mx-auto max-w-xl px-4 py-8"><div className="skeleton shimmer h-8 w-48" /><div className="card mt-4 h-40" /></div>;
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"><Truck className="h-4 w-4" /></span>
          <span className="font-bold">FleetTrack Driver</span>
          <span className="ml-auto hidden text-xs text-slate-500 sm:block">{me?.name}</span>
          <button className="btn-ghost !p-2" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <button className="btn-ghost !p-2" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:hidden">
        <div className="grid grid-cols-3">
          {NAV.map(n => {
            const active = n.exact ? path === n.href : path.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                <Icon className="h-5 w-5" />{n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
