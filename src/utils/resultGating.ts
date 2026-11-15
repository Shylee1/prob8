import type { PropertyRecord, SubscriptionTier } from '../types';

export const FREE_RESULTS_PER_COUNTY = 2;

export interface GatedSearchResults {
  unlocked: PropertyRecord[];
  totalAvailable: number;
  lockedCount: number;
  isGated: boolean;
  freeCap: number;
  perCountyLimit: number;
  countiesRepresented: number;
}

export function applyFreemiumResultGating(
  properties: PropertyRecord[],
  tier: SubscriptionTier,
  isNationalBrowse: boolean,
  queryTotalAvailable: number,
  nationwideTotalAvailable: number,
  perCountyLimit: number = FREE_RESULTS_PER_COUNTY
): GatedSearchResults {
  const totalAvailable = isNationalBrowse
    ? Math.max(properties.length, nationwideTotalAvailable)
    : Math.max(properties.length, queryTotalAvailable);

  const uniqueCounties = new Set(
    properties.map((p) => `${(p.county || 'Unknown').toLowerCase()}|${(p.state || 'US').toLowerCase()}`)
  );

  if (tier === 'pro' || tier === 'vip_lifetime') {
    return {
      unlocked: properties,
      totalAvailable,
      lockedCount: 0,
      isGated: false,
      freeCap: properties.length,
      perCountyLimit,
      countiesRepresented: uniqueCounties.size,
    };
  }

  const safePerCounty = Math.max(1, perCountyLimit);
  const perCountyCounts = new Map<string, number>();
  const unlocked: PropertyRecord[] = [];

  for (const prop of properties) {
    const key = `${(prop.county || 'default-county').toLowerCase()}|${(prop.state || 'us').toLowerCase()}`;
    const count = perCountyCounts.get(key) ?? 0;
    if (count < safePerCounty) {
      perCountyCounts.set(key, count + 1);
      unlocked.push(prop);
    }
  }

  const lockedCount = Math.max(0, totalAvailable - unlocked.length);

  return {
    unlocked,
    totalAvailable,
    lockedCount,
    isGated: lockedCount > 0,
    freeCap: unlocked.length,
    perCountyLimit: safePerCounty,
    countiesRepresented: perCountyCounts.size,
  };
}
