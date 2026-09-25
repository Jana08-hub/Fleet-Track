'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Opts { vehicleId: string; tripId: string; enabled: boolean; simulated?: boolean; }

export function useGpsTracker({ vehicleId, tripId, enabled, simulated }: Opts) {
  const [status, setStatus] = useState<'idle' | 'active' | 'denied' | 'error' | 'offline'>('idle');
  const [last, setLast] = useState<any>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) { setStatus('error'); return; }
    if (!navigator.onLine) setStatus('offline');

    const send = async (pos: GeolocationPosition) => {
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
      try {
        const saved = await api('/api/gps/location', { method: 'POST', body: JSON.stringify(payload) });
        setLast({ ...saved, at: new Date().toISOString() });
        setStatus('active');
      } catch {
        setStatus('error');
      }
    };

    watchId.current = navigator.geolocation.watchPosition(send, (err) => {
      setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [enabled, vehicleId, tripId, simulated]);

  return { status, last };
}
