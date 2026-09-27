'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hourglass, LogOut, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = ['Account created', 'Email verified', 'Admin approval', 'Start tracking'];

export default function Pending() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function recheck() {
    setBusy(true); setMsg('');
    try {
      const me = await api('/api/auth/me');
      if (me.emailVerified) {
        router.push(me.role === 'ADMIN' ? '/admin' : '/driver');
        return;
      }
      setMsg('Email not verified yet — check your inbox or contact your administrator.');
    } catch { setMsg('Session expired. Please log in again.'); }
    setBusy(false);
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_role');
    router.push('/login');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Hourglass className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Pending approval</h1>
        <p className="page-sub">Your email is verified, but an administrator must approve your account before you can continue.</p>
        <ol className="mx-auto mt-6 max-w-xs space-y-2.5 text-left text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < 2 ? 'bg-emerald-500 text-white' : i === 2 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                {i < 2 ? '✓' : i + 1}
              </span>
              <span className={i <= 2 ? 'font-semibold' : 'text-slate-500'}>{s}</span>
            </li>
          ))}
        </ol>
        {msg && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">{msg}</p>}
        <div className="mt-6 flex gap-2">
          <button className="btn flex-1 !py-3" onClick={recheck} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Checking…' : 'Check again'}
          </button>
          <button className="btn-ghost !py-3" onClick={logout}><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </main>
  );
}
