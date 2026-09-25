'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Truck, Mail, ArrowLeft, Info, CheckCircle2 } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      setMsg((await r.json()).message || 'Done');
    } catch { setMsg('Network error. Is the server running?'); }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-4xl overflow-hidden sm:grid sm:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-950 p-8 text-white sm:flex">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><Truck className="h-5 w-5" /></span>
            <span className="text-xl font-bold">FleetTrack</span>
          </div>
          <h2 className="text-2xl font-bold leading-snug">Locked out?<br />We&apos;ll get you back in.</h2>
          <p className="text-xs text-slate-500">Reset links expire in 1 hour.</p>
        </div>
        <form onSubmit={submit} className="p-6 sm:p-10">
          <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
          <p className="page-sub">Enter your account email and we&apos;ll send a reset link.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="email" className="input !pl-10" type="email" required placeholder="you@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <button className="btn w-full !py-3" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            {msg && <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>}
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
            {!msg && <p className="flex items-start gap-2 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />For privacy, we always show success — check your inbox only if the address is registered.</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
