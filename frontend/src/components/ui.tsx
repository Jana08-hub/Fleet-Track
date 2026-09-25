import type { ReactNode } from 'react';

/* ---------- status badge ---------- */
const badgeTones: Record<string, string> = {
  green: 'badge-green', red: 'badge-red', amber: 'badge-amber', blue: 'badge-blue', slate: 'badge-slate',
};
export function Badge({ tone = 'slate', children }: { tone?: keyof typeof badgeTones | string; children: ReactNode }) {
  const cls = (badgeTones as Record<string, string>)[tone] || 'badge-slate';
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function statusTone(s?: string): string {
  if (!s) return 'slate';
  const v = s.toUpperCase();
  if (['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'ONLINE', 'SENT'].includes(v)) return 'green';
  if (['IN_TRIP', 'DELAYED', 'PENDING', 'PLANNED'].includes(v)) return 'blue';
  if (['MAINTENANCE', 'UNVERIFIED', 'OFFLINE', 'STALE'].includes(v)) return 'amber';
  if (['DISABLED', 'REJECTED', 'CANCELLED', 'FAILED', 'CRITICAL'].includes(v)) return 'red';
  return 'slate';
}

/* ---------- page header ---------- */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- stat card ---------- */
export function Stat({ label, value, icon, tone = 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', hint }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: string; hint?: string;
}) {
  return (
    <div className="card card-p">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

/* ---------- empty + loading ---------- */
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">∅</div>
      <p className="mt-3 font-semibold">{title}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export function SkeletonCards({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card card-p"><div className="skeleton shimmer h-4 w-1/2" /><div className="skeleton mt-3 h-8 w-2/3" /></div>
      ))}
    </div>
  );
}

/* ---------- tiny SVG charts (no deps) ---------- */
export function BarChart({ data, height = 140 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const w = 560, h = height, pad = 24;
  const bw = (w - pad * 2) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} x2={w - 8} y1={h - 20 - (h - 40) * f} y2={h - 20 - (h - 40) * f} stroke="currentColor" strokeOpacity="0.12" />
      ))}
      {data.map((d, i) => {
        const bh = Math.max(3, ((h - 40) * d.value) / max);
        const x = pad + i * bw + bw * 0.2;
        return (
          <g key={i}>
            <rect x={x} y={h - 20 - bh} width={bw * 0.6} height={bh} rx="4" fill="#2563eb" opacity={d.value ? 0.9 : 0.25}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text x={x + bw * 0.3} y={h - 6} fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.6">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ segments, size = 150 }: { segments: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 60, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 150 150" role="img">
        <circle cx="75" cy="75" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="18" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const off = acc; acc += frac;
          return <circle key={i} cx="75" cy="75" r={r} fill="none" stroke={s.color} strokeWidth="18"
            strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-off * c} transform="rotate(-90 75 75)" strokeLinecap="butt">
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>;
        })}
        <text x="75" y="72" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">{total}</text>
        <text x="75" y="90" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.6">total</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums pl-3">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- date helpers ---------- */
export function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function last7Days(): string[] {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}
