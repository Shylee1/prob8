import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { Globe2, Layers, LocateFixed, MapPin, Navigation, Search, Eye } from 'lucide-react';
import type { PropertyRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { StreetViewPanel } from './StreetViewPanel';

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
}

type MapVisualMode = 'roadmap' | 'satellite' | 'hybrid' | 'streetview';

interface PlaceSuggestionItem {
  placePrediction?: {
    text: { text: string };
  };
}

const US_CENTER = { lat: 39.8283, lng: -98.5795 };

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
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [mapMode, setMapMode] = useState<MapVisualMode>('roadmap');
  const [hoveredProp, setHoveredProp] = useState<PropertyRecord | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([]);

  const isApiLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const coreLib = useMapsLibrary('core');
  const placesLib = useMapsLibrary('places');
  const mapInstance = useMap();
  const sessionTokenRef = useRef<unknown>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

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
  }, [hideMapOnMobile, mapInstance, recenterMap]);

  useEffect(() => {
    if (!placesLib || !searchInput.trim() || searchInput.trim().length < 2) {
      setSuggestions([]);
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
          if (!cancelled) setSuggestions(res.suggestions ?? []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, searchInput]);

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
      sessionTokenRef.current = null;
      if (label) onSearchLocation(label);
    },
    [onSearchLocation]
  );

  const activeStreetTarget = selectedProperty ?? hoveredProp ?? properties[0];
  const mapsUnavailable =
    apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <div className="flex flex-col gap-3 h-full">
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
          hideMapOnMobile ? 'hidden lg:block' : 'block h-[480px] sm:h-[580px]'
        } relative lg:h-auto lg:flex-1 min-h-[440px] lg:min-h-[460px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#111827]`}
      >
        <div
          role="group"
          aria-label="Map View Mode"
          className="absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] overflow-x-auto items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-[#111827]/95 p-1 shadow-sm backdrop-blur-md"
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
              className={`inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mapMode === mode.id
                  ? 'bg-[#0F766E] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {mapMode === 'streetview' && activeStreetTarget ? (
          <div className="h-full w-full">
            <StreetViewPanel
              lat={activeStreetTarget.lat}
              lng={activeStreetTarget.lng}
              address={`${activeStreetTarget.address}, ${activeStreetTarget.city}, ${activeStreetTarget.state}`}
              heightClass="h-full min-h-[440px] lg:min-h-[460px]"
            />
          </div>
        ) : mapsUnavailable || !isApiLoaded ? (
          <div className="flex h-full min-h-[440px] flex-col items-center justify-center bg-slate-900 p-6 text-center text-white">
            <Globe2 className="h-8 w-8 text-[#5EEAD4]" />
            <h3 className="mt-3 font-display text-base font-semibold">
              {mapsUnavailable ? 'Google Maps Interactive Canvas Unavailable' : 'Initializing Real-Time Google Maps...'}
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-300">
              Showing {properties.length} live unlocked probate parcels. Click any property card to open its full Prob8 Dossier.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {properties.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProperty(p)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#5EEAD4]" />
                  <span>{p.address}, {p.state}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={US_CENTER}
            defaultZoom={4}
            mapTypeId={mapMode}
            gestureHandling="greedy"
            streetViewControl={true}
            mapTypeControl={false}
            fullscreenControl={true}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%', minHeight: '440px' }}
          >
            {properties.map((prop) => {
              const isSaved = savedPropertyIds.has(prop.id);
              const isSelected = selectedProperty?.id === prop.id;
              return (
                <AdvancedMarker
                  key={prop.id}
                  position={{ lat: prop.lat, lng: prop.lng }}
                  title={`${prop.address}, ${prop.city}, ${prop.state}`}
                  onClick={() => {
                    setHoveredProp(prop);
                    onSelectProperty(prop);
                  }}
                >
                  <Pin
                    background={isSelected ? '#B45309' : prop.status === 'auction' ? '#4F46E5' : isSaved ? '#0F766E' : '#0F172A'}
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={isSelected ? 1.2 : 1.0}
                  />
                </AdvancedMarker>
              );
            })}

            {hoveredProp && (
              <InfoWindow
                position={{ lat: hoveredProp.lat, lng: hoveredProp.lng }}
                onCloseClick={() => setHoveredProp(null)}
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
        )}
      </div>
    </div>
  );
};
