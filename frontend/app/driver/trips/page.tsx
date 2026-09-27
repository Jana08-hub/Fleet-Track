'use client';
import { useEffect, useState } from 'react';
import { Truck, Plus, X, Pencil, Check, Navigation } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Empty, statusTone, timeAgo } from '@/components/ui';

const PURPOSES = ['Delivery', 'Passenger transport', 'Goods transport', 'Service visit', 'Other'];

function durationDays(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86400000));
}

function tripDurationMs(t: any) {
  if (!t.actualStartTime || !t.actualEndTime) return null;
  const ms = new Date(t.actualEndTime).getTime() - new Date(t.actualStartTime).getTime();
  return isNaN(ms) || ms < 0 ? null : ms;
}

function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const EMPTY_FORM = {
  vehicleId: '', source: '', destination: '',
  startLatitude: undefined as number | undefined, startLongitude: undefined as number | undefined,
  tripDate: '', startTime: '', expectedArrivalTime: '',
  purpose: '', notes: '',
};
const EMPTY_STOP = { name: '', address: '', expectedArrivalTime: '' };

export default function DriverTrips() {
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [stops, setStops] = useState<Array<typeof EMPTY_STOP>>([]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

  const load = () => { api('/api/trips?limit=100').then(d => setItems(d.trips || [])).catch(() => {}); };
  useEffect(() => {
    load();
    api('/api/auth/me').then(setMe).catch(() => {});
    api('/api/vehicles').then(d => setVehicles((d.vehicles || []).filter((v: any) => v.status === 'ACTIVE'))).catch(() => {});
  }, []);

  const mine = me ? items.filter(t => t.driver?.user?.id === me.id) : items;
  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);
  const plannedStart = form.tripDate && form.startTime ? new Date(`${form.tripDate}T${form.startTime}`) : null;
  const formDays = durationDays(plannedStart?.toISOString(), form.expectedArrivalTime || undefined);
  const today = new Date().toISOString().slice(0, 10);

  function useCurrentLocation() {
    setGeoMsg('');
    if (!('geolocation' in navigator)) { setGeoMsg('Geolocation is not supported by this browser.'); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        const { latitude, longitude } = pos.coords;
        setForm(f => ({ ...f, source: `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, startLatitude: latitude, startLongitude: longitude }));
      },
      (err) => {
        setGeoBusy(false);
        setGeoMsg(err.code === err.PERMISSION_DENIED
          ? 'Location permission is required to use your current location.'
          : 'GPS signal is unavailable. Please move outdoors and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function validate(): string | null {
    if (!form.vehicleId) return 'Please select a vehicle.';
    if (!form.source.trim()) return 'Please enter a starting location.';
    if (!form.destination.trim()) return 'Please enter a destination.';
    if (!form.tripDate) return 'Please select a trip date.';
    if (!form.startTime) return 'Please select a planned start time.';
    if (!plannedStart || isNaN(+plannedStart)) return 'Invalid trip date or start time.';
    if (form.expectedArrivalTime && new Date(form.expectedArrivalTime) <= plannedStart) {
      return 'Expected arrival must be after the planned start.';
    }
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i].name.trim()) return `Stop ${i + 1}: please enter a stop name or remove the stop.`;
    }
    return null;
  }

  function review(e: React.FormEvent) {
    e.preventDefault(); setMsg(''); setOk('');
    const err = validate();
    if (err) { setMsg(err); return; }
    setStep('review');
  }

  async function create() {
    setMsg(''); setBusy(true);
    try {
      await api('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          source: form.source.trim(),
          destination: form.destination.trim(),
          startLatitude: form.startLatitude,
          startLongitude: form.startLongitude,
          purpose: form.purpose || undefined,
          notes: form.notes.trim() || undefined,
          plannedStartTime: plannedStart!.toISOString(),
          expectedArrivalTime: form.expectedArrivalTime || undefined,
          stops: stops.map(s => ({
            name: s.name.trim(),
            address: s.address.trim() || undefined,
            expectedArrivalTime: s.expectedArrivalTime || undefined,
          })),
        }),
      });
      setForm({ ...EMPTY_FORM }); setStops([]); setStep('form'); setShowForm(false);
      setOk('Trip created successfully. Select it on the GPS Tracking page to start.');
      load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  const summaryRows: Array<[string, string]> = [
    ['Vehicle', selectedVehicle ? `${selectedVehicle.registrationNumber}${selectedVehicle.brand || selectedVehicle.model ? ` — ${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}`.trimEnd() : ''}` : '—'],
    ['Driver', me ? `${me.name} (${me.email})` : '—'],
    ['From', form.source || '—'],
    ['To', form.destination || '—'],
    ['Stops', stops.length ? stops.map((s, i) => `${i + 1}. ${s.name}${s.address ? ` — ${s.address}` : ''}${s.expectedArrivalTime ? ` (ETA ${new Date(s.expectedArrivalTime).toLocaleString()})` : ''}`).join(' | ') : 'None'],
    ['Trip Date', form.tripDate || '—'],
    ['Planned Start', plannedStart ? plannedStart.toLocaleString() : '—'],
    ['Expected Arrival', form.expectedArrivalTime ? new Date(form.expectedArrivalTime).toLocaleString() : '—'],
    ['Duration', formDays != null ? `${formDays} day${formDays === 1 ? '' : 's'}` : '—'],
    ['Purpose', form.purpose || '—'],
    ['Notes', form.notes || '—'],
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <div>
          <h1 className="page-title">My trips</h1>
          <p className="page-sub">{mine.length} trips on record · trip history below</p>
        </div>
        <button className="btn ml-auto" onClick={() => { setShowForm(s => !s); setStep('form'); setMsg(''); setOk(''); }}><Plus className="h-4 w-4" /> New trip</button>
      </div>
      {ok && <p className="card card-p mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" />{ok}</p>}

      {showForm && step === 'form' && (
        <form onSubmit={review} className="card card-p mb-4 mt-4">
          <h2 className="text-lg font-bold">Create New Trip</h2>
          <p className="page-sub">Fill in the trip details yourself, then review before creating.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Vehicle *</label>
              <select className="input" required value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">{vehicles.length ? 'Select vehicle…' : 'No vehicles available'}</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber}{v.brand || v.model ? ` — ${v.brand || ''} ${v.model || ''}`.trimEnd() : ''}</option>)}
              </select>
              {vehicles.length === 0 && <p className="mt-1 text-xs text-amber-600">No vehicles available — please contact your administrator to add one.</p>}</div>
            <div><label className="label">Driver</label>
              <input className="input bg-slate-50 dark:bg-slate-800" readOnly value={me ? `${me.name} (${me.email})` : 'Loading…'} /></div>

            <div><label className="label">Starting location *</label>
              <input className="input" required placeholder="Location name or full address" value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value, startLatitude: undefined, startLongitude: undefined })} />
              <button type="button" className="btn-ghost mt-1 !py-1.5 text-xs" onClick={useCurrentLocation} disabled={geoBusy}>
                <Navigation className="h-3.5 w-3.5" /> {geoBusy ? 'Locating…' : 'Use Current Location'}</button>
              {geoMsg && <p className="mt-1 text-xs text-red-600">{geoMsg}</p>}</div>
            <div><label className="label">Destination *</label>
              <input className="input" required placeholder="Destination name or full address" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></div>

            <div className="sm:col-span-2">
              <label className="label">Stops / waypoints (optional)</label>
              {stops.map((s, i) => (
                <div key={i} className="mb-2 grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <input className="input" placeholder={`Stop ${i + 1} name *`} value={s.name}
                    onChange={e => setStops(stops.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input className="input" placeholder="Address (optional)" value={s.address}
                    onChange={e => setStops(stops.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} />
                  <input type="datetime-local" className="input" title="Expected arrival (optional)" value={s.expectedArrivalTime}
                    onChange={e => setStops(stops.map((x, j) => j === i ? { ...x, expectedArrivalTime: e.target.value } : x))} />
                  <button type="button" className="btn-ghost" title="Remove stop" onClick={() => setStops(stops.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {stops.length < 10 && (
                <button type="button" className="btn-ghost text-xs" onClick={() => setStops([...stops, { ...EMPTY_STOP }])}><Plus className="h-3.5 w-3.5" /> Add Stop</button>
              )}
            </div>

            <div><label className="label">Trip date *</label>
              <input type="date" className="input" required min={today} value={form.tripDate} onChange={e => setForm({ ...form, tripDate: e.target.value })} /></div>
            <div><label className="label">Planned start time *</label>
              <input type="time" className="input" required value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="label">Expected arrival (optional)</label>
              <input type="datetime-local" className="input" value={form.expectedArrivalTime}
                min={plannedStart ? plannedStart.toISOString().slice(0, 16) : undefined}
                onChange={e => setForm({ ...form, expectedArrivalTime: e.target.value })} /></div>
            <div><label className="label">Trip purpose (optional)</label>
              <select className="input" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>
                <option value="">Select purpose…</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div className="sm:col-span-2"><label className="label">Notes (optional)</label>
              <textarea className="input min-h-[80px]" placeholder="Additional instructions or trip information…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              <span><span className="text-slate-400">Vehicle:</span> {selectedVehicle ? selectedVehicle.registrationNumber : '—'}</span>
              <span className="tabular-nums"><span className="text-slate-400">Duration:</span> {formDays != null ? `${formDays} day${formDays === 1 ? '' : 's'}` : '—'}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="btn">Review trip</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      {showForm && step === 'review' && (
        <div className="card card-p mb-4 mt-4">
          <h2 className="text-lg font-bold">Trip Summary</h2>
          <p className="page-sub">Review the details — the trip is only created when you confirm.</p>
          <dl className="mt-4 space-y-2 text-sm">
            {summaryRows.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-36 shrink-0 text-slate-500">{k}:</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn" onClick={create} disabled={busy}><Check className="h-4 w-4" /> {busy ? 'Creating…' : 'Create Trip'}</button>
            <button className="btn-ghost" onClick={() => setStep('form')} disabled={busy}><Pencil className="h-4 w-4" /> Edit Details</button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {mine.map(t => {
          const dur = tripDurationMs(t);
          return (
            <div key={t.id} className="card card-p !py-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-400" />
                <p className="font-semibold">{t.source} → {t.destination}</p>
                <span className="ml-auto"><Badge tone={statusTone(t.status)}>{t.status}</Badge></span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Vehicle: {t.vehicle?.registrationNumber || '—'}{t.vehicle?.brand || t.vehicle?.model ? ` (${t.vehicle?.brand || ''} ${t.vehicle?.model || ''}`.trimEnd() + ')' : ''}
                {' · '}Driver: {t.driver?.user?.name || '—'}
              </p>
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {(t.totalDistance || 0).toFixed(1)} km
                {t.averageSpeed ? ` · ${t.averageSpeed.toFixed(0)} km/h avg` : ''}
                {dur != null ? ` · ${fmtDuration(dur)}` : ''}
                {t.plannedStartTime ? ` · Start: ${new Date(t.plannedStartTime).toLocaleString()}` : ''}
                {t.expectedArrivalTime ? ` · End: ${new Date(t.expectedArrivalTime).toLocaleString()}` : ''}
                {` · ${timeAgo(t.createdAt)}`}
              </p>
              {t.purpose && <p className="mt-1 text-xs text-slate-500">Purpose: {t.purpose}</p>}
              {t.notes && <p className="mt-1 text-xs text-slate-500">Notes: {t.notes}</p>}
              {(t.stops || []).length > 0 && (
                <p className="mt-1 text-xs text-slate-500">Stops: {(t.stops || []).map((s: any) => s.name).join(' → ')}</p>
              )}
            </div>
          );
        })}
        {mine.length === 0 && <div className="card"><Empty title="No trips yet" sub="Create your first trip above — it will appear on the GPS Tracking page." /></div>}
      </div>
    </>
  );
}
