import React, { useEffect, useRef, useState } from 'react';
import { useApiIsLoaded, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Compass, ExternalLink, MapPin } from 'lucide-react';

interface StreetViewPanelProps {
  lat: number;
  lng: number;
  address: string;
  heightClass?: string;
}

function computeCompassHeading(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(fromLat);
  const phi2 = toRad(toLat);
  const dLambda = toRad(toLng - fromLng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const raw = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Number.isFinite(raw) ? Number(raw.toFixed(1)) : 0;
}

export const StreetViewPanel: React.FC<StreetViewPanelProps> = ({
  lat,
  lng,
  address,
  heightClass = 'h-[320px] sm:h-[380px]',
}) => {
  const isApiLoaded = useApiIsLoaded();
  const streetViewLib = useMapsLibrary('streetView');
  const geocodingLib = useMapsLibrary('geocoding');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [resolvedPos, setResolvedPos] = useState<{ lat: number; lng: number; heading: number }>({
    lat,
    lng,
    heading: 0,
  });

  useEffect(() => {
    setResolvedPos({ lat, lng, heading: 0 });
  }, [lat, lng, address]);

  useEffect(() => {
    if (!isApiLoaded || !streetViewLib || !containerRef.current) return;

    let cancelled = false;
    setStatus('loading');

    const resolveTargetAndLoadPano = async () => {
      let targetLat = lat;
      let targetLng = lng;

      // 1. Geocode exact street address so camera targets the true parcel rooftop instead of coarse city coordinates
      if (geocodingLib && address.trim() && !address.startsWith('GPS ')) {
        try {
          const geocoder = new geocodingLib.Geocoder();
          const geoResp = await geocoder.geocode({ address });
          const loc = geoResp.results?.[0]?.geometry?.location;
          if (loc) {
            const gLat = loc.lat();
            const gLng = loc.lng();
            if (Math.hypot(gLat - lat, gLng - lng) < 0.25) {
              targetLat = gLat;
              targetLng = gLng;
            }
          }
        } catch {
          // Fallback cleanly to server-provided parcel coordinates
        }
      }

      if (cancelled || !containerRef.current) return;

      const svService = new streetViewLib.StreetViewService();
      try {
        const result = await svService.getPanorama({
          location: { lat: targetLat, lng: targetLng },
          radius: 75,
          preference: streetViewLib.StreetViewPreference.NEAREST,
          source: streetViewLib.StreetViewSource.OUTDOOR,
        });

        if (cancelled || !containerRef.current) return;
        const panoId = result?.data?.location?.pano;
        if (!panoId) {
          setStatus('unavailable');
          return;
        }

        const camLatLng = result.data?.location?.latLng;
        const camLat = camLatLng ? camLatLng.lat() : targetLat;
        const camLng = camLatLng ? camLatLng.lng() : targetLng;
        const heading =
          Math.hypot(camLat - targetLat, camLng - targetLng) > 1e-6
            ? computeCompassHeading(camLat, camLng, targetLat, targetLng)
            : 0;

        setResolvedPos({ lat: targetLat, lng: targetLng, heading });

        const pano = new streetViewLib.StreetViewPanorama(containerRef.current, {
          pano: panoId,
          pov: { heading, pitch: 4 },
          visible: true,
          addressControl: true,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          fullscreenControl: true,
          enableCloseButton: false,
          motionTracking: false,
        });
        pano.setVisible(true);
        setStatus('available');
      } catch {
        if (!cancelled) {
          setResolvedPos({ lat: targetLat, lng: targetLng, heading: 0 });
          setStatus('unavailable');
        }
      }
    };

    void resolveTargetAndLoadPano();

    return () => {
      cancelled = true;
    };
  }, [isApiLoaded, streetViewLib, geocodingLib, lat, lng, address]);

  const externalStreetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${resolvedPos.lat},${resolvedPos.lng}&heading=${resolvedPos.heading}&pitch=4`;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full min-h-[220px]" />

      {status === 'available' && (
        <div className="pointer-events-none absolute left-3 bottom-3 z-10 flex items-center gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          <MapPin className="h-3 w-3 text-[#5EEAD4]" />
          <span className="truncate max-w-[260px] sm:max-w-sm">{address}</span>
          <span className="font-mono text-slate-300">({resolvedPos.heading}°)</span>
        </div>
      )}

      {status !== 'available' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#5EEAD4]">
            <Compass className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold">
            {status === 'loading'
              ? `Orienting Street View onto ${address}...`
              : 'Street-level panorama unavailable at this exact parcel'}
          </p>
          <p className="mt-1 text-xs text-slate-300 max-w-md">
            {address} · {resolvedPos.lat.toFixed(5)}, {resolvedPos.lng.toFixed(5)}
          </p>
          <a
            href={externalStreetViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D625B]"
          >
            <MapPin className="h-3.5 w-3.5" />
            Open Street View in Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
