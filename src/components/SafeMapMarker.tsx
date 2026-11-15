import React, { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface SafeMapMarkerProps {
  position: { lat: number; lng: number };
  title?: string;
  color?: string;
  glyph?: string;
  scale?: number;
  onClick?: () => void;
}

/**
 * Renders a standard Google Maps marker wrapped in defensive guards so an
 * invalid or over-quota Google Maps key never throws an uncaught passive-unmount
 * TypeError inside React's commit phase.
 */
export const SafeMapMarker: React.FC<SafeMapMarkerProps> = ({
  position,
  title,
  color = '#0F766E',
  glyph,
  scale = 1,
  onClick,
}) => {
  const map = useMap();
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map) return;
    const g = (
      window as unknown as {
        google?: {
          maps?: {
            Marker?: new (opts: Record<string, unknown>) => {
              setMap: (m: unknown) => void;
              addListener: (ev: string, cb: () => void) => { remove: () => void };
            };
            SymbolPath?: { CIRCLE: number };
          };
        };
      }
    ).google;
    const MarkerCtor = g?.maps?.Marker;
    if (!MarkerCtor) return;

    let marker: {
      setMap: (m: unknown) => void;
      addListener: (ev: string, cb: () => void) => { remove: () => void };
    } | null = null;
    let listener: { remove: () => void } | null = null;

    try {
      marker = new MarkerCtor({
        position,
        map,
        title,
        label: glyph
          ? {
              text: glyph,
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '700',
            }
          : undefined,
        icon: g?.maps?.SymbolPath
          ? {
              path: g.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: Math.round(9 * scale),
            }
          : undefined,
      });
      if (onClickRef.current) {
        listener = marker.addListener('click', () => {
          onClickRef.current?.();
        });
      }
    } catch {
      // Non-fatal when Google Maps key is over quota or invalid
    }

    return () => {
      try {
        listener?.remove();
      } catch {
        // Ignore cleanup errors
      }
      try {
        marker?.setMap(null);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [map, position.lat, position.lng, title, color, glyph, scale]);

  return null;
};
