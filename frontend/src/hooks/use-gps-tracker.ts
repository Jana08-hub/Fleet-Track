'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Opts { vehicleId: string; tripId: string; enabled: boolean; simulated?: boolean; }

const QUEUE_KEY = 'ft_gps_queue';
const POOR_ACCURACY_M = 100;
const REJECT_ACCURACY_M = 5000;

function loadQueue(): any[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(q: any[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200))); } catch {}
}

export function useGpsTracker({ vehicleId, tripId, enabled, simulated }: Opts) {
  const [status, setStatus] = useState<'idle' | 'active' | 'denied' | 'error' | 'offline'>('idle');
  const [last, setLast] = useState<any>(null);
  const [queued, setQueued] = useState(0);
  const [poorAccuracy, setPoorAccuracy] = useState(false);
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const watchId = useRef<number | null>(null);
  const flushTimer = useRef<any>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const flush = useCallback(async () => {
    const q = loadQueue();
    if (!q.length || !navigator.onLine) { setQueued(q.length); return; }
    const remaining: any[] = [];
    for (const payload of q) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await api('/api/gps/location', { method: 'POST', body: JSON.stringify(payload) });
      } catch { remaining.push(payload); break; }
    }
    saveQueue(remaining);
    setQueued(remaining.length);
    if (remaining.length === 0 && enabledRef.current) setStatus('active');
  }, []);

  // Fresh trail per trip/vehicle
  useEffect(() => { setTrail([]); }, [tripId, vehicleId]);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) { setStatus('error'); return; }    if (!navigator.onLine) setStatus('offline');
    setQueued(loadQueue().length);

    const onOnline = () => { setStatus((s) => (s === 'offline' ? 'active' : s)); flush(); };
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    flushTimer.current = setInterval(flush, 15000);

    const send = async (pos: GeolocationPosition) => {
      const accuracy = pos.coords.accuracy;
      setPoorAccuracy(accuracy != null && accuracy > POOR_ACCURACY_M && accuracy <= REJECT_ACCURACY_M);
      // Mirror server rule: drop >5000m fixes with a visible warning instead of a failed POST
      if (accuracy != null && accuracy > REJECT_ACCURACY_M) {
        setLast({ accuracy, at: new Date().toISOString(), rejected: true });
        setStatus('error');
        return;
      }
      const payload = {
        vehicleId, tripId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed ? pos.coords.speed * 3.6 : undefined,
        heading: pos.coords.heading ?? undefined,
        altitude: pos.coords.altitude ?? undefined,
        deviceTimestamp: new Date(pos.timestamp).toISOString(),
        isSimulated: !!simulated,
      };
      // client validation: lat/lng ranges
      if (payload.latitude < -90 || payload.latitude > 90 || payload.longitude < -180 || payload.longitude > 180) return;
      if (!navigator.onLine) {
        const q = [...loadQueue(), payload];
        saveQueue(q); setQueued(q.length); setStatus('offline');
        setLast({ ...payload, at: new Date().toISOString(), queued: true });
        return;
      }
      try {
        const saved = await api('/api/gps/location', { method: 'POST', body: JSON.stringify(payload) });
        setLast({ ...saved, at: new Date().toISOString() });
        setTrail(prev => [...prev.slice(-499), [pos.coords.latitude, pos.coords.longitude]]);
        setStatus('active');
        if (loadQueue().length) flush();
      } catch {
        // Network/server failure → queue for retry
        const q = [...loadQueue(), payload];
        saveQueue(q); setQueued(q.length);
        setStatus(navigator.onLine ? 'error' : 'offline');
      }
    };

    watchId.current = navigator.geolocation.watchPosition(send, (err) => {
      setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [enabled, vehicleId, tripId, simulated, flush]);

  return { status, last, queued, poorAccuracy, trail, flush };
}
