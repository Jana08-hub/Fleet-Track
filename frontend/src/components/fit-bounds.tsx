'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points as any, { padding: [30, 30] });
    else if (points.length === 1) map.setView(points[0] as any, Math.max(map.getZoom(), 13));
  }, [map, JSON.stringify(points)]);
  return null;
}
