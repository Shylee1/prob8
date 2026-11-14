import type { PropertyRecord, SubscriptionTier } from '../types';

export interface GatedSearchResults {
  unlocked: PropertyRecord[];
  totalAvailable: number;
  lockedCount: number;
  isGated: boolean;
  freeCap: number;
}

export function applyFreemiumResultGating(
  properties: PropertyRecord[],
  tier: SubscriptionTier,
  isNationalBrowse: boolean,
  queryTotalAvailable: number,
  nationwideTotalAvailable: number
): GatedSearchResults {
  const totalAvailable = isNationalBrowse
    ? Math.max(properties.length, nationwideTotalAvailable)
    : Math.max(properties.length, queryTotalAvailable);

  if (tier === 'pro' || tier === 'vip_lifetime') {
    return {
      unlocked: properties,
      totalAvailable,
      lockedCount: 0,
      isGated: false,
      freeCap: properties.length,
    };
  }

  const freeCap = isNationalBrowse ? 10 : 5;
  const unlocked = properties.slice(0, freeCap);
  const lockedCount = Math.max(0, totalAvailable - unlocked.length);

  return {
    unlocked,
    totalAvailable,
    lockedCount,
    isGated: lockedCount > 0,
    freeCap,
  };
}
