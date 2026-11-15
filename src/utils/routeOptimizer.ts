import type { FieldRouteStop } from '../types';

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function optimizeFieldRouteOrder(
  stops: FieldRouteStop[],
  startCoords?: { lat: number; lng: number }
): { ordered: FieldRouteStop[]; totalDistanceMiles: number } {
  if (stops.length <= 1) {
    return { ordered: [...stops], totalDistanceMiles: 0 };
  }

  const remaining = [...stops];
  const ordered: FieldRouteStop[] = [];
  let totalDistanceMiles = 0;

  let currentLat = startCoords?.lat ?? remaining[0].lat;
  let currentLng = startCoords?.lng ?? remaining[0].lng;

  if (!startCoords) {
    const first = remaining.shift()!;
    ordered.push(first);
    currentLat = first.lat;
    currentLng = first.lng;
  }

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [nextStop] = remaining.splice(bestIdx, 1);
    ordered.push(nextStop);
    totalDistanceMiles += Number.isFinite(bestDist) ? bestDist : 0;
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
  }

  return {
    ordered,
    totalDistanceMiles: Number(totalDistanceMiles.toFixed(1)),
  };
}
