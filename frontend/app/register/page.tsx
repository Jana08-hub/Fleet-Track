'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, User, Mail, Lock, Phone, IdCard, CalendarDays, ShieldCheck, CircleAlert, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { API_URL } from '@/lib/api';

type Step = 'details' | 'otp' | 'done';

const FIELDS = [
  ['name', 'Full name', User, 'text', 'e.g. Arjun Mehta'],
  ['email', 'Email', Mail, 'email', 'you@company.com'],
  ['password', 'Password (min 8 chars)', Lock, 'password', '••••••••'],
  ['phoneNumber', 'Phone number', Phone, 'tel', '+919000000000'],
  ['licenseNumber', 'Driving license number', IdCard, 'text', 'TS09-2020-0001234'],
  ['licenseExpiry', 'License expiry', CalendarDays, 'date', ''],
] as const;

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({ name: '', email: '', password: '', phoneNumber: '', licenseNumber: '', licenseExpiry: '' });
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setMsg(''); setOkMsg('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register/request-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Could not send code');
      setOkMsg(b.message);
      setStep('otp');
      setCooldown(60);
      setTimeout(() => boxRefs.current[0]?.focus(), 100);
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  function typeDigit(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) boxRefs.current[i + 1]?.focus();
  }
  function keyDigit(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus();
  }
  function pasteDigits(e: React.ClipboardEvent) {
    const nums = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!nums.length) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    nums.forEach((n, i) => { next[i] = n; });
    setDigits(next);
    boxRefs.current[Math.min(nums.length, 5)]?.focus();
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: digits.join('') }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Verification failed');
      setStep('done');
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  const steps = ['Your details', 'Verify email', 'Done'];
  const stepIdx = step === 'details' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-4xl overflow-hidden sm:grid sm:grid-cols-5">
        <div className="hidden flex-col justify-between bg-slate-950 p-8 text-white sm:col-span-2 sm:flex">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><Truck className="h-5 w-5" /></span>
            <span className="text-xl font-bold">FleetTrack</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-snug">Join your fleet<br />in minutes.</h2>
            <ol className="mt-5 space-y-2.5 text-sm">
              {steps.map((s, i) => (
                <li key={s} className={`flex items-center gap-2.5 ${i <= stepIdx ? 'text-white' : 'text-slate-500'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < stepIdx ? 'bg-emerald-500' : i === stepIdx ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    {i < stepIdx ? '✓' : i + 1}
                  </span>{s}
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-slate-500">Accounts are approved by your administrator after verification.</p>
        </div>

        <div className="p-6 sm:col-span-3 sm:p-8">
          {step === 'details' && (
            <form onSubmit={requestOtp}>
              <h1 className="text-2xl font-bold tracking-tight">Create driver account</h1>
              <p className="page-sub">Step 1 of 2 — we&apos;ll email you a verification code.</p>
              <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                {FIELDS.map(([k, label, Icon, type, ph]) => (
                  <div key={k} className={k === 'name' || k === 'email' ? 'sm:col-span-2' : ''}>
                    <label className="label" htmlFor={k}>{label}</label>
                    <div className="relative">
                      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input id={k} type={type} required minLength={k === 'password' ? 8 : undefined}
                        className="input !pl-10" placeholder={ph} value={form[k]} onChange={set(k)} />
                    </div>
                  </div>
                ))}
              </div>
              {msg && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>}
              <button className="btn mt-5 w-full !py-3" disabled={busy}>{busy ? 'Sending code…' : <>Send verification code <ArrowRight className="h-4 w-4" /></>}</button>
              <p className="mt-3 text-sm text-slate-500">Have an account? <Link className="font-semibold text-blue-600 hover:underline" href="/login">Log in</Link></p>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verify}>
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="page-sub">Enter the 6-digit code sent to <b>{form.email}</b>. Expires in 10 minutes.</p>
              {okMsg && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">{okMsg}</p>}
              <div className="mt-5 flex justify-between gap-2" onPaste={pasteDigits}>
                {digits.map((d, i) => (
                  <input key={i} ref={el => { boxRefs.current[i] = el; }} inputMode="numeric" maxLength={1} required
                    className="input !px-0 text-center !text-xl font-bold tabular-nums" value={d}
                    onChange={e => typeDigit(i, e.target.value)} onKeyDown={e => keyDigit(i, e)} aria-label={`Digit ${i + 1}`} />
                ))}
              </div>
              {msg && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>}
              <button className="btn mt-5 w-full !py-3" disabled={busy}><ShieldCheck className="h-4 w-4" /> {busy ? 'Verifying…' : 'Verify & create account'}</button>
              <div className="mt-3 flex items-center justify-between text-sm">
                <button type="button" className="font-semibold text-slate-500 hover:underline" onClick={() => setStep('details')}>
                  <span className="inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Edit details</span>
                </button>
                <button type="button" disabled={cooldown > 0 || busy} onClick={() => requestOtp()}
                  className="font-semibold text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight">Driver account created</h1>
              <p className="page-sub mx-auto mt-2 max-w-sm">Your email is verified. An administrator will approve your account — you&apos;ll be able to log in right after.</p>
              <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-xl bg-blue-50 p-3 text-left text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> You can try logging in anytime; we&apos;ll tell you the moment you&apos;re approved.
              </p>
              <button className="btn mt-6 w-full !py-3" onClick={() => router.push('/login')}>Go to login <ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
