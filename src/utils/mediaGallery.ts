export interface MediaGalleryResolution {
  mode: 'photos' | 'streetview_satellite';
  selectedSource: 'zillow' | 'redfin' | 'google_maps';
  photos: string[];
  zillowRealCount: number;
  redfinRealCount: number;
  reason: string;
}

const GENERIC_PLACEHOLDER_PATTERNS = [
  /maps\.googleapis\.com/i,
  /streetviewpixels/i,
  /staticmap/i,
  /no[_-]?photo/i,
  /placeholder/i,
  /default[_-]?home/i,
  /map[_-]?thumb/i,
  /satellite[_-]?thumb/i,
  /tile\.openstreetmap/i,
  /placeholder\.com/i,
  /unsplash\.com/i,
  /picsum\.photos/i,
];

/**
 * Checks whether a candidate image URL represents a genuine uploaded property photograph
 * rather than a generic map thumbnail, Street View static tile, or empty placeholder.
 */
export function isRealPropertyPhoto(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!(trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
    return false;
  }
  return !GENERIC_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Enforces the strict Zillow / Redfin 3-image threshold logic:
 * - Inspect real uploaded photo counts from Zillow and Redfin.
 * - If a source has 0 photos OR <= 3 generic/minimal images, skip that source and fall back
 *   to the other source if it contains > 3 genuine uploaded property photos.
 * - If neither source has > 3 genuine photos, fall back cleanly to interactive Google Street View
 *   and real-time Satellite View so broken images or map thumbnails are never shown in the carousel.
 */
export function resolveSmartPropertyMedia(
  zillowPhotos: string[] = [],
  redfinPhotos: string[] = []
): MediaGalleryResolution {
  const zillowReal = zillowPhotos.filter(isRealPropertyPhoto);
  const redfinReal = redfinPhotos.filter(isRealPropertyPhoto);

  if (zillowReal.length > 3) {
    return {
      mode: 'photos',
      selectedSource: 'zillow',
      photos: zillowReal,
      zillowRealCount: zillowReal.length,
      redfinRealCount: redfinReal.length,
      reason: `Loaded ${zillowReal.length} verified photos from Zillow.`,
    };
  }

  if (redfinReal.length > 3) {
    return {
      mode: 'photos',
      selectedSource: 'redfin',
      photos: redfinReal,
      zillowRealCount: zillowReal.length,
      redfinRealCount: redfinReal.length,
      reason: `Skipped Zillow (${zillowReal.length} <= 3 threshold) and loaded ${redfinReal.length} verified photos from Redfin.`,
    };
  }

  return {
    mode: 'streetview_satellite',
    selectedSource: 'google_maps',
    photos: [],
    zillowRealCount: zillowReal.length,
    redfinRealCount: redfinReal.length,
    reason: `Neither Zillow (${zillowReal.length}) nor Redfin (${redfinReal.length}) exceeded the 3-photo threshold; displaying live Google Street View & Satellite imagery.`,
  };
}
