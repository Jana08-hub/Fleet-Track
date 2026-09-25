'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Truck, MailCheck, CircleAlert, Loader2, ArrowRight } from 'lucide-react';
import { API_URL } from '@/lib/api';

function Inner() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [msg, setMsg] = useState('Verifying your email…');

  useEffect(() => {
    if (!token) { setState('fail'); setMsg('This link is missing its token. Open the full link from your email.'); return; }
    fetch(`${API_URL}/api/auth/verify-email?token=${token}`)
      .then(async r => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setState('ok'); setMsg(b.message);
      })
      .catch((e) => { setState('fail'); setMsg(e.message || 'Verification failed.'); });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white"><Truck className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Email verification</h1>
        <div className="mt-4">
          {state === 'loading' && <p className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{msg}</p>}
          {state === 'ok' && (
            <>
              <p className="mx-auto flex items-start justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><MailCheck className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>
              <Link href="/login" className="btn mt-5 w-full !py-3">Continue to login <ArrowRight className="h-4 w-4" /></Link>
            </>
          )}
          {state === 'fail' && (
            <>
              <p className="mx-auto flex items-start justify-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>
              <p className="mt-3 text-sm text-slate-500">Links expire after 24 hours and can be used once. Ask your administrator to resend the verification email.</p>
              <Link href="/login" className="btn-ghost mt-5 w-full !py-3">Back to login</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Page() { return <Suspense><Inner /></Suspense>; }
