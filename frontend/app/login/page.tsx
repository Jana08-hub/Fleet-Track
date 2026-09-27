'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Mail, Lock, CircleAlert } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Login failed');
      }
      localStorage.setItem('ft_token', body.token);
      localStorage.setItem('ft_role', body.user.role);
      router.push(body.user.role === 'ADMIN' ? '/admin' : '/driver');
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-4xl overflow-hidden sm:grid sm:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-950 p-8 text-white sm:flex">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><Truck className="h-5 w-5" /></span>
            <span className="text-xl font-bold">FleetTrack</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-snug">Your entire fleet,<br />live on one map.</h2>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
              <li>✓ Real-time GPS from driver phones</li>
              <li>✓ Geofences, alerts & trip history</li>
              <li>✓ Maintenance and analytics</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">Secure · Role-based · Audited</p>
        </div>
        <form onSubmit={submit} className="p-6 sm:p-10">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="page-sub">Log in to your fleet dashboard.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="email" className="input !pl-10" placeholder="you@company.com" autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="password" className="input !pl-10" type="password" placeholder="••••••••" autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>
            {err && <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{err}</p>}
            <button className="btn w-full !py-3" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">New here? <Link className="font-semibold text-blue-600 hover:underline" href="/register">Register</Link></span>
              <Link className="font-semibold text-blue-600 hover:underline" href="/forgot-password">Forgot password?</Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
