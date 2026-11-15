import React, { useMemo, useState } from 'react';
import {
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  useApiIsLoaded,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  Briefcase,
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Route,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { FieldRouteStop, PipelineDeal, PropertyRecord } from '../types';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import { optimizeFieldRouteOrder } from '../utils/routeOptimizer';
import { ErrorBoundary } from './ErrorBoundary';
import { SafeMapMarker } from './SafeMapMarker';

const HAS_GOOGLE_MAPS_KEY = Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim());

interface FieldRouteViewProps {
  stops: FieldRouteStop[];
  pipelineDeals: PipelineDeal[];
  searchedProperties: PropertyRecord[];
  onPinCurrentGps: (input: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    address: string;
    city: string;
    state: string;
    conditionTag: FieldRouteStop['conditionTag'];
    notes: string;
  }) => void;
  onAddPropertyStop: (property: PropertyRecord, conditionTag?: FieldRouteStop['conditionTag']) => void;
  onRemoveStop: (stopId: string) => void;
  onReorderStops?: (ordered: FieldRouteStop[]) => void;
  onQuickAddToPipeline: (stop: FieldRouteStop) => void;
  onQuickAddToCrm: (stop: FieldRouteStop) => void;
  onOpenDossier: (property: PropertyRecord) => void;
  onGoToDiscover: () => void;
}

const CONDITION_TAGS: FieldRouteStop['conditionTag'][] = [
  'Vacant / Overgrown',
  'Boarded / Distressed',
  'Probate Lead',
  'Follow-Up Needed',
];

export const FieldRouteView: React.FC<FieldRouteViewProps> = ({
  stops,
  pipelineDeals,
  searchedProperties,
  onPinCurrentGps,
  onAddPropertyStop,
  onRemoveStop,
  onReorderStops,
  onQuickAddToPipeline,
  onQuickAddToCrm,
  onOpenDossier,
  onGoToDiscover,
}) => {
  const [selectedCondition, setSelectedCondition] =
    useState<FieldRouteStop['conditionTag']>('Vacant / Overgrown');
  const [quickNote, setQuickNote] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [propertyToImportId, setPropertyToImportId] = useState('');

  const availableImports = useMemo(() => {
    const existingPropIds = new Set(stops.map((s) => s.property?.id).filter(Boolean));
    const combined = [...pipelineDeals.map((d) => d.property), ...searchedProperties];
    const seen = new Set<string>();
    return combined.filter((p) => {
      if (seen.has(p.id) || existingPropIds.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [stops, pipelineDeals, searchedProperties]);

  const selectedStop = useMemo(
    () => stops.find((s) => s.id === selectedStopId) ?? stops[0] ?? null,
    [stops, selectedStopId]
  );

  const mapCenter = useMemo(() => {
    if (selectedStop) return { lat: selectedStop.lat, lng: selectedStop.lng };
    return { lat: 39.8283, lng: -98.5795 };
  }, [selectedStop]);

  const googleMapsDirectionsUrl = useMemo(() => {
    if (stops.length === 0) return 'https://www.google.com/maps';
    const dest = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
    const waypoints = stops
      .slice(0, -1)
      .slice(0, 8)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');
    const wpParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${wpParam}&travelmode=driving`;
  }, [stops]);

  const handleDrivePinGps = () => {
    setGeoMessage(null);
    if (!navigator.geolocation) {
      setGeoMessage('GPS geolocation unavailable on this device.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);
        let address = `Pinned ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        let city = 'Field Pin';
        let state = 'US';

        try {
          const resp = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          if (resp.ok) {
            const geo = (await resp.json()) as { city?: string; state?: string };
            if (geo.city) city = geo.city;
            if (geo.state) state = geo.state;
            address = `GPS Pin near ${city}, ${state}`;
          }
        } catch {
          // Keep raw coordinates label cleanly
        }

        onPinCurrentGps({
          lat,
          lng,
          accuracyMeters: accuracy,
          address,
          city,
          state,
          conditionTag: selectedCondition,
          notes: quickNote.trim() || `Driving-for-Dollars capture (${selectedCondition})`,
        });
        setQuickNote('');
        setIsLocating(false);
        setGeoMessage(`Logged GPS stop (${lat}, ${lng}) ±${accuracy}m`);
      },
      () => {
        setIsLocating(false);
        setGeoMessage('Location permission denied. Enable GPS to log live driving pins.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-5">
      {/* Driving-for-Dollars Mobile-First Command Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Navigation className="h-5 w-5 text-[#0F766E] dark:text-emerald-400" />
              Driving-for-Dollars Field Route ({stops.length} {stops.length === 1 ? 'Stop' : 'Stops'})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Starts clean with zero pre-populated stops. Pin live GPS distress finds while driving or import parcels from Discover/Pipeline.
            </p>
          </div>

          {stops.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {stops.length > 1 && onReorderStops && (
                <button
                  type="button"
                  onClick={() => {
                    const { ordered, totalDistanceMiles } = optimizeFieldRouteOrder(stops);
                    onReorderStops(ordered);
                    setGeoMessage(`Optimized ${ordered.length} stops (~${totalDistanceMiles} mi shortest path).`);
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-4 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Route className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Optimize Stop Order
                </button>
              )}
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <ExternalLink className="h-4 w-4" />
                Launch Turn-by-Turn Route
              </a>
            </div>
          )}
        </div>

        {/* Mobile Thumb-Friendly GPS Capture Strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="md:col-span-3">
            <label htmlFor="drive-condition" className="sr-only">Condition Tag</label>
            <select
              id="drive-condition"
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value as FieldRouteStop['conditionTag'])}
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {CONDITION_TAGS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <input
              type="text"
              aria-label="Quick driving field note"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Optional note (e.g., tarp on roof, tall grass, probate notice)..."
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button
              type="button"
              onClick={handleDrivePinGps}
              disabled={isLocating}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60"
            >
              <LocateFixed className={`h-4 w-4 ${isLocating ? 'animate-pulse' : ''}`} />
              {isLocating ? 'Locking GPS...' : 'Pin Current GPS Location'}
            </button>
          </div>
        </div>

        {availableImports.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <select
              aria-label="Import searched or pipeline property to field route"
              value={propertyToImportId}
              onChange={(e) => setPropertyToImportId(e.target.value)}
              className="flex-1 min-w-[200px] h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
            >
              <option value="">Add parcel from Discover or Pipeline...</option>
              {availableImports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}, {p.city}, {p.state}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!propertyToImportId}
              onClick={() => {
                const found = availableImports.find((p) => p.id === propertyToImportId);
                if (found) {
                  onAddPropertyStop(found, selectedCondition);
                  setPropertyToImportId('');
                }
              }}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-800 dark:text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stop
            </button>
          </div>
        )}

        {geoMessage && (
          <p className="text-xs font-semibold text-[#0F766E] dark:text-emerald-400">{geoMessage}</p>
        )}
      </div>

      {/* Empty State when 0 stops have been added */}
      {stops.length === 0 ? (
        <div className="mx-auto max-w-2xl py-12 px-4 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/70 dark:bg-[#111827]/70">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400">
            <MapPin className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
            Your Driving-for-Dollars Route is Empty
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Tap <strong>Pin Current GPS Location</strong> while driving to capture coordinates &amp; timestamps on distressed properties, or return to Discover to pick probate stops.
          </p>
          <button
            type="button"
            onClick={onGoToDiscover}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 text-xs font-semibold text-white"
          >
            <Compass className="h-4 w-4" />
            Browse Nationwide Probate Parcels
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Stop Cards */}
          <div className="lg:col-span-5 space-y-3">
            {stops.map((stop, idx) => {
              const isSelected = selectedStop?.id === stop.id;
              return (
                <article
                  key={stop.id}
                  onClick={() => setSelectedStopId(stop.id)}
                  className={`cursor-pointer rounded-2xl border bg-white dark:bg-[#111827] p-4 space-y-3 transition-all ${
                    isSelected
                      ? 'border-[#0F766E] ring-2 ring-[#0F766E]/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-[#0F766E] dark:text-emerald-400">
                        STOP {idx + 1} · {stop.conditionTag}
                      </p>
                      <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                        {stop.address}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {stop.city}, {stop.state} · Logged {formatDateShort(stop.visitedAt)}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5 tabular-nums">
                        GPS: {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                        {stop.gpsAccuracyMeters ? ` (±${stop.gpsAccuracyMeters}m)` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveStop(stop.id);
                      }}
                      aria-label={`Remove stop ${stop.address}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {stop.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#090D16] rounded-lg px-2.5 py-1.5">
                      {stop.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddToPipeline(stop);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#0F766E] px-2.5 text-[11px] font-semibold text-white hover:bg-[#0D625B]"
                    >
                      <Briefcase className="h-3 w-3" />
                      Add to Pipeline
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddToCrm(stop);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <UserPlus className="h-3 w-3" />
                      Add to CRM
                    </button>
                    {stop.property && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (stop.property) onOpenDossier(stop.property);
                        }}
                        className="ml-auto text-[11px] font-semibold text-[#0F766E] dark:text-emerald-400 hover:underline"
                      >
                        Dossier ({formatCurrency(stop.property.avmValue)})
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Right Live Google Map with Tap-to-Inspect Pins */}
          <div className="lg:col-span-7 min-h-[420px] lg:min-h-[580px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#111827]">
            {!HAS_GOOGLE_MAPS_KEY ? (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-slate-900 p-6 text-center text-white">
                <Navigation className="h-8 w-8 text-[#5EEAD4]" />
                <p className="mt-3 font-display text-base font-semibold">
                  Field Route Pin Tracker Ready ({stops.length} stops)
                </p>
                <p className="mt-1 max-w-sm text-xs text-slate-300">
                  Tap any stop on the left or click Launch Turn-by-Turn Route above.
                </p>
              </div>
            ) : (
              <LiveFieldRouteMap
                stops={stops}
                mapCenter={mapCenter}
                selectedStop={selectedStop}
                onSelectStop={setSelectedStopId}
                onQuickAddToPipeline={onQuickAddToPipeline}
                onQuickAddToCrm={onQuickAddToCrm}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const LiveFieldRouteMap: React.FC<{
  stops: FieldRouteStop[];
  mapCenter: { lat: number; lng: number };
  selectedStop: FieldRouteStop | null;
  onSelectStop: (id: string | null) => void;
  onQuickAddToPipeline: (stop: FieldRouteStop) => void;
  onQuickAddToCrm: (stop: FieldRouteStop) => void;
}> = ({ stops, mapCenter, selectedStop, onSelectStop, onQuickAddToPipeline, onQuickAddToCrm }) => {
  const isApiLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const [authFailed, setAuthFailed] = useState<boolean>(() =>
    Boolean((window as unknown as { __prob8MapsUnavailable?: boolean }).__prob8MapsUnavailable)
  );

  React.useEffect(() => {
    const onQuota = () => setAuthFailed(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const mapsUnavailable =
    authFailed || apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE;

  const fallbackView = (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-slate-900 p-6 text-center text-white">
      <Navigation className="h-8 w-8 text-[#5EEAD4]" />
      <p className="mt-3 font-display text-base font-semibold">
        Field Route Pin Tracker Ready ({stops.length} stops)
      </p>
      <p className="mt-1 max-w-sm text-xs text-slate-300">
        Tap any stop on the left or click Launch Turn-by-Turn Route above.
      </p>
    </div>
  );

  if (mapsUnavailable || !isApiLoaded) {
    return fallbackView;
  }

  return (
    <ErrorBoundary fallback={fallbackView}>
      <GoogleMap
        defaultCenter={mapCenter}
        defaultZoom={stops.length > 1 ? 11 : 14}
        gestureHandling="greedy"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '420px' }}
      >
        {stops.map((stop, idx) => (
          <SafeMapMarker
            key={stop.id}
            position={{ lat: stop.lat, lng: stop.lng }}
            title={`Stop ${idx + 1}: ${stop.address}`}
            color="#0F766E"
            glyph={String(idx + 1)}
            onClick={() => onSelectStop(stop.id)}
          />
        ))}

        {selectedStop && (
          <InfoWindow
            position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
            onCloseClick={() => onSelectStop(null)}
          >
            <div className="min-w-[190px] p-1 text-slate-900 space-y-1.5">
              <p className="font-display text-xs font-bold">{selectedStop.address}</p>
              <p className="text-[11px] text-slate-500">{selectedStop.conditionTag}</p>
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onQuickAddToPipeline(selectedStop)}
                  className="flex-1 rounded bg-[#0F766E] px-2 py-1 text-[11px] font-semibold text-white"
                >
                  + Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => onQuickAddToCrm(selectedStop)}
                  className="flex-1 rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white"
                >
                  + CRM
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </ErrorBoundary>
  );
};
