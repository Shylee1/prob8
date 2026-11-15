import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  InfoWindow,
  Map as GoogleMap,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { Globe2, Layers, LocateFixed, MapPin, Navigation, Search, Eye } from 'lucide-react';
import type { PropertyRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ErrorBoundary } from './ErrorBoundary';
import { SafeMapMarker } from './SafeMapMarker';
import { StreetViewPanel } from './StreetViewPanel';

const HAS_GOOGLE_MAPS_KEY = Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim());

interface NationalSearchMapProps {
  properties: PropertyRecord[];
  selectedProperty: PropertyRecord | null;
  center: { lat: number; lng: number };
  isNationalBrowse: boolean;
  onSelectProperty: (property: PropertyRecord) => void;
  onSearchLocation: (query: string) => void;
  onUseMyLocation: () => void;
  isSearching: boolean;
  savedPropertyIds: Set<string>;
  hideMapOnMobile?: boolean;
  totalAvailable?: number;
  lockedCount?: number;
  isProUnlocked?: boolean;
}

type MapVisualMode = 'roadmap' | 'satellite' | 'hybrid' | 'streetview';

interface PlaceSuggestionItem {
  placePrediction?: {
    text: { text: string };
  };
}

const US_CENTER = { lat: 39.8283, lng: -98.5795 };

const FallbackParcelGrid: React.FC<{
  properties: PropertyRecord[];
  selectedProperty: PropertyRecord | null;
  onSelectProperty: (property: PropertyRecord) => void;
  isProUnlocked: boolean;
  lockedCount: number;
  totalAvailable: number;
  statusNote?: string;
}> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  isProUnlocked,
  lockedCount,
  totalAvailable,
  statusNote,
}) => (
  <div className="flex h-full min-h-[380px] flex-col justify-between bg-gradient-to-br from-slate-950 via-[#0F172A] to-slate-900 p-4 sm:p-5 text-white">
    <div className="flex flex-col items-center text-center pt-1">
      <Globe2 className="h-7 w-7 text-[#5EEAD4]" />
      <h3 className="mt-2 font-display text-base font-bold">
        {statusNote || 'Interactive US Probate Parcel Coverage View'}
      </h3>
      <p className="mt-1 max-w-md text-xs text-slate-300">
        {isProUnlocked
          ? `100% Unlocked: All ${properties.length} live courthouse parcels ready across Map & List.`
          : `Showing ${properties.length} unlocked preview parcels (${lockedCount.toLocaleString()} of ${totalAvailable.toLocaleString()} hidden on Free Tier).`}
      </p>
    </div>

    <div className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[300px] pr-1">
      {properties.map((p) => {
        const isSelected = selectedProperty?.id === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectProperty(p)}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
              isSelected
                ? 'border-[#5EEAD4] bg-[#0F766E]/30 text-white'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <div className="min-w-0">
              <p className="font-semibold truncate flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#5EEAD4]" />
                <span className="truncate">{p.address}</span>
              </p>
              <p className="text-[11px] text-slate-400 truncate pl-5">
                {p.city}, {p.state} · {p.county}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] shrink-0">
              <p className="font-bold text-[#5EEAD4]">{formatCurrency(p.avmValue)}</p>
              <p className="text-slate-400">{p.equityPct}% Eq</p>
            </div>
          </button>
        );
      })}
    </div>

    <p className="text-center text-[11px] text-slate-400">
      Configure <code className="font-mono text-slate-300">VITE_GOOGLE_MAPS_API_KEY</code> to overlay satellite &amp; street vector tiles.
    </p>
  </div>
);

const PlacesAutocompleteFetcher: React.FC<{
  searchInput: string;
  onSuggestions: (items: PlaceSuggestionItem[]) => void;
}> = ({ searchInput, onSuggestions }) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<unknown>(null);

  useEffect(() => {
    if (!placesLib || !searchInput.trim() || searchInput.trim().length < 2) {
      onSuggestions([]);
      return;
    }
    let cancelled = false;
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: searchInput,
        includedRegionCodes: ['us'],
        sessionToken: (sessionTokenRef.current ?? undefined) as never,
      })
        .then((res: { suggestions?: PlaceSuggestionItem[] }) => {
          if (!cancelled) onSuggestions(res.suggestions ?? []);
        })
        .catch(() => {
          if (!cancelled) onSuggestions([]);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, searchInput, onSuggestions]);

  return null;
};

const LiveGoogleMapCanvas: React.FC<{
  properties: PropertyRecord[];
  selectedProperty: PropertyRecord | null;
  center: { lat: number; lng: number };
  isNationalBrowse: boolean;
  mapMode: 'roadmap' | 'satellite' | 'hybrid';
  hoveredProp: PropertyRecord | null;
  onHoverProp: (prop: PropertyRecord | null) => void;
  onSelectProperty: (property: PropertyRecord) => void;
  savedPropertyIds: Set<string>;
  hideMapOnMobile: boolean;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  isProUnlocked: boolean;
  lockedCount: number;
  totalAvailable: number;
}> = ({
  properties,
  selectedProperty,
  center,
  isNationalBrowse,
  mapMode,
  hoveredProp,
  onHoverProp,
  onSelectProperty,
  savedPropertyIds,
  hideMapOnMobile,
  mapContainerRef,
  isProUnlocked,
  lockedCount,
  totalAvailable,
}) => {
  const isApiLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const coreLib = useMapsLibrary('core');
  const mapInstance = useMap();
  const [authFailed, setAuthFailed] = useState<boolean>(() =>
    Boolean((window as unknown as { __prob8MapsUnavailable?: boolean }).__prob8MapsUnavailable)
  );

  useEffect(() => {
    const markFailed = () => setAuthFailed(true);
    window.addEventListener('gmp-quota-exceeded', markFailed);
    const prev = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      markFailed();
      if (typeof prev === 'function') prev();
    };
    return () => {
      window.removeEventListener('gmp-quota-exceeded', markFailed);
    };
  }, []);

  const recenterMap = useCallback(() => {
    if (!mapInstance) return;
    if (isNationalBrowse) {
      mapInstance.setCenter(US_CENTER);
      mapInstance.setZoom(4);
    } else if (properties.length > 0 && coreLib?.LatLngBounds) {
      const bounds = new coreLib.LatLngBounds();
      properties.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapInstance.fitBounds(bounds, 56);
    } else {
      mapInstance.setCenter(center);
      mapInstance.setZoom(12);
    }
  }, [mapInstance, coreLib, center, isNationalBrowse, properties]);

  useEffect(() => {
    recenterMap();
  }, [recenterMap]);

  useEffect(() => {
    if (hideMapOnMobile || !mapInstance || !mapContainerRef.current) return;
    const node = mapContainerRef.current;

    const triggerResizeAndCenter = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const gmaps = (window as unknown as { google?: { maps?: { event?: { trigger: (inst: unknown, ev: string) => void } } } }).google;
      gmaps?.maps?.event?.trigger(mapInstance, 'resize');
      recenterMap();
    };

    const rafId = requestAnimationFrame(triggerResizeAndCenter);
    const timeoutId = setTimeout(triggerResizeAndCenter, 120);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        triggerResizeAndCenter();
      });
      observer.observe(node);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [hideMapOnMobile, mapInstance, mapContainerRef, recenterMap]);

  const mapsUnavailable =
    authFailed || apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE;

  const fallbackGrid = (
    <FallbackParcelGrid
      properties={properties}
      selectedProperty={selectedProperty}
      onSelectProperty={onSelectProperty}
      isProUnlocked={isProUnlocked}
      lockedCount={lockedCount}
      totalAvailable={totalAvailable}
      statusNote={
        mapsUnavailable ? 'Interactive US Probate Parcel Coverage View' : 'Initializing Real-Time Google Maps...'
      }
    />
  );

  if (mapsUnavailable || !isApiLoaded) {
    return fallbackGrid;
  }

  return (
    <ErrorBoundary fallback={fallbackGrid}>
      <GoogleMap
        defaultCenter={US_CENTER}
        defaultZoom={4}
        mapTypeId={mapMode}
        gestureHandling="greedy"
        streetViewControl={true}
        mapTypeControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
      >
        {properties.map((prop) => {
          const isSaved = savedPropertyIds.has(prop.id);
          const isSelected = selectedProperty?.id === prop.id;
          const pinColor = isSelected
            ? '#B45309'
            : prop.status === 'auction'
              ? '#4F46E5'
              : isSaved
                ? '#0F766E'
                : '#0F172A';
          return (
            <SafeMapMarker
              key={prop.id}
              position={{ lat: prop.lat, lng: prop.lng }}
              title={`${prop.address}, ${prop.city}, ${prop.state}`}
              color={pinColor}
              scale={isSelected ? 1.2 : 1.0}
              onClick={() => {
                onHoverProp(prop);
                onSelectProperty(prop);
              }}
            />
          );
        })}

        {hoveredProp && (
          <InfoWindow
            position={{ lat: hoveredProp.lat, lng: hoveredProp.lng }}
            onCloseClick={() => onHoverProp(null)}
          >
            <div className="min-w-[190px] p-1 text-slate-900">
              <p className="font-display text-sm font-bold">{hoveredProp.address}</p>
              <p className="text-xs text-slate-500">
                {hoveredProp.city}, {hoveredProp.state} {hoveredProp.zip}
              </p>
              <p className="mt-1.5 font-mono text-xs font-semibold text-[#0F766E] tabular-nums">
                Est {formatCurrency(hoveredProp.avmValue)} · Ask {formatCurrency(hoveredProp.probatePrice)}
              </p>
              <button
                type="button"
                onClick={() => onSelectProperty(hoveredProp)}
                className="mt-2 w-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open Full Dossier
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </ErrorBoundary>
  );
};

export const NationalSearchMap: React.FC<NationalSearchMapProps> = ({
  properties,
  selectedProperty,
  center,
  isNationalBrowse,
  onSelectProperty,
  onSearchLocation,
  onUseMyLocation,
  isSearching,
  savedPropertyIds,
  hideMapOnMobile = false,
  totalAvailable = properties.length,
  lockedCount = 0,
  isProUnlocked = true,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [mapMode, setMapMode] = useState<MapVisualMode>('roadmap');
  const [hoveredProp, setHoveredProp] = useState<PropertyRecord | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isNationalBrowse) {
      setSearchInput('');
      setSuggestions([]);
    }
  }, [isNationalBrowse]);

  const handleSubmitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchInput.trim()) return;
      setShowSuggestions(false);
      onSearchLocation(searchInput.trim());
    },
    [searchInput, onSearchLocation]
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: PlaceSuggestionItem) => {
      const label = suggestion.placePrediction?.text.text ?? '';
      setSearchInput(label);
      setShowSuggestions(false);
      if (label) onSearchLocation(label);
    },
    [onSearchLocation]
  );

  const activeStreetTarget = selectedProperty ?? hoveredProp ?? properties[0];

  return (
    <div className="flex flex-col gap-3 h-full">
      {HAS_GOOGLE_MAPS_KEY && (
        <PlacesAutocompleteFetcher searchInput={searchInput} onSuggestions={setSuggestions} />
      )}

      <form onSubmit={handleSubmitSearch} className="relative z-20 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <label htmlFor="national-probate-search" className="sr-only">
            Search any US State, County, City, or Zip Code
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="national-probate-search"
            type="text"
            value={searchInput}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Search any US State, County, City, or Zip (e.g., Columbus OH, Maricopa AZ, 33133)..."
            className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-xs focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-12 z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] py-1.5 shadow-lg">
              {suggestions.map((s, idx) => {
                const text = s.placePrediction?.text.text;
                if (!text) return null;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-[#0F766E] dark:text-emerald-400" />
                      <span className="truncate">{text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            disabled={isSearching}
            className="h-11 rounded-xl bg-[#0F766E] px-4 text-sm font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isSearching ? 'Searching...' : 'Search US'}
          </button>
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={isSearching}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <LocateFixed className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
            <span className="hidden sm:inline">Near Me</span>
          </button>
        </div>
      </form>

      <div
        ref={mapContainerRef}
        className={`${
          hideMapOnMobile ? 'hidden lg:flex' : 'flex h-[480px] sm:h-[580px]'
        } relative flex-col lg:h-auto lg:flex-1 min-h-[440px] lg:min-h-[460px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2 z-10">
          <div
            role="group"
            aria-label="Map View Mode"
            className="inline-flex max-w-full overflow-x-auto items-center gap-1 rounded-xl border border-slate-700 bg-[#090D16] p-1"
          >
            {(
              [
                { id: 'roadmap', label: 'Map', icon: <Globe2 className="h-3.5 w-3.5" /> },
                { id: 'satellite', label: 'Satellite', icon: <Layers className="h-3.5 w-3.5" /> },
                { id: 'hybrid', label: 'Hybrid', icon: <Navigation className="h-3.5 w-3.5" /> },
                { id: 'streetview', label: 'Street View', icon: <Eye className="h-3.5 w-3.5" /> },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMapMode(mode.id)}
                className={`inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mapMode === mode.id
                    ? 'bg-[#0F766E] text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <div
            aria-label="Map Parcel Visibility Status"
            className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-[#090D16] px-3 py-1.5 text-[11px] font-mono font-semibold"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isProUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-100 tabular-nums">
              {isProUnlocked
                ? `100% Unlocked · ${properties.length} Map Pins`
                : `${properties.length} Pins · ${lockedCount.toLocaleString()} of ${totalAvailable.toLocaleString()} Hidden`}
            </span>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          {mapMode === 'streetview' && activeStreetTarget ? (
            <div className="h-full w-full">
              <StreetViewPanel
                lat={activeStreetTarget.lat}
                lng={activeStreetTarget.lng}
                address={`${activeStreetTarget.address}, ${activeStreetTarget.city}, ${activeStreetTarget.state}`}
                heightClass="h-full min-h-[380px]"
              />
            </div>
          ) : !HAS_GOOGLE_MAPS_KEY ? (
            <FallbackParcelGrid
              properties={properties}
              selectedProperty={selectedProperty}
              onSelectProperty={onSelectProperty}
              isProUnlocked={isProUnlocked}
              lockedCount={lockedCount}
              totalAvailable={totalAvailable}
            />
          ) : (
            <LiveGoogleMapCanvas
              properties={properties}
              selectedProperty={selectedProperty}
              center={center}
              isNationalBrowse={isNationalBrowse}
              mapMode={mapMode === 'streetview' ? 'roadmap' : mapMode}
              hoveredProp={hoveredProp}
              onHoverProp={setHoveredProp}
              onSelectProperty={onSelectProperty}
              savedPropertyIds={savedPropertyIds}
              hideMapOnMobile={hideMapOnMobile}
              mapContainerRef={mapContainerRef}
              isProUnlocked={isProUnlocked}
              lockedCount={lockedCount}
              totalAvailable={totalAvailable}
            />
          )}
        </div>
      </div>
    </div>
  );
};
