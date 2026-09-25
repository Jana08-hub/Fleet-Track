'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Truck, Lock, ArrowLeft, CheckCircle2, CircleAlert } from 'lucide-react';
import { API_URL } from '@/lib/api';

function Inner() {
  const token = useSearchParams().get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setMsg('Passwords do not match.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Reset failed');
      setOk(true); setMsg(b.message);
    } catch (e: any) { setMsg(e.message); }
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
          <h2 className="text-2xl font-bold leading-snug">Choose a strong<br />new password.</h2>
          <p className="text-xs text-slate-500">Use 8+ characters with a mix of cases and numbers.</p>
        </div>
        <div className="p-6 sm:p-10">
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          {!token && <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />This link is missing its token. Open the full link from your email.</p>}
          {token && !ok && (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {[['pw', 'New password', pw, setPw], ['pw2', 'Confirm password', pw2, setPw2]].map(([id, ph, v, set]) => (
                <div key={id as string}>
                  <label className="label" htmlFor={id as string}>{ph as string}</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input id={id as string} className="input !pl-10" type="password" required minLength={8}
                      value={v as string} onChange={e => (set as any)(e.target.value)} />
                  </div>
                </div>
              ))}
              <button className="btn w-full !py-3" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
            </form>
          )}
          {msg && (
            <p className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}>
              {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}{msg}
            </p>
          )}
          <Link href="/login" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
        </div>
      </div>
    </main>
  );
}

export default function Page() { return <Suspense><Inner /></Suspense>; }
