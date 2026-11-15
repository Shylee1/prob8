import type { PropertyRecord } from '../types';

export interface MotivationScoreBreakdown {
  score: number;
  tier: 'Hot' | 'Warm' | 'Standard';
  factors: string[];
}

export function calculateMotivationScore(
  property: Pick<
    PropertyRecord,
    | 'filingDate'
    | 'status'
    | 'equityPct'
    | 'taxDelinquent'
    | 'isVacant'
    | 'preForeclosureOverlap'
    | 'probateAttorney'
  >,
  referenceDate: Date = new Date()
): MotivationScoreBreakdown {
  let score = 25;
  const factors: string[] = [];

  const parsedFiling = Date.parse(property.filingDate);
  const daysSinceFiling = Number.isFinite(parsedFiling)
    ? Math.max(0, Math.floor((referenceDate.getTime() - parsedFiling) / 86400000))
    : 0;

  if (property.status === 'auction') {
    score += 22;
    factors.push('Active Auction');
  } else if (daysSinceFiling >= 90) {
    score += 20;
    factors.push('90+ Day Docket');
  } else if (daysSinceFiling >= 21 && daysSinceFiling <= 45) {
    score += 14;
    factors.push('Prime 21-45d Window');
  } else if (daysSinceFiling > 45) {
    score += 12;
    factors.push('45+ Day Docket');
  } else {
    score += 6;
  }

  if (property.equityPct >= 65) {
    score += 20;
    factors.push(`${Math.round(property.equityPct)}% Equity`);
  } else if (property.equityPct >= 40) {
    score += 12;
    factors.push(`${Math.round(property.equityPct)}% Equity`);
  }

  if (property.taxDelinquent) {
    score += 14;
    factors.push('Tax Delinquent');
  }
  if (property.isVacant) {
    score += 12;
    factors.push('Vacant');
  }
  if (property.preForeclosureOverlap) {
    score += 15;
    factors.push('Pre-Foreclosure Overlap');
  }
  if (property.probateAttorney && /pro se/i.test(property.probateAttorney)) {
    score += 6;
    factors.push('Pro Se Executor');
  }

  const clamped = Math.max(1, Math.min(100, Math.round(score)));
  const tier: MotivationScoreBreakdown['tier'] =
    clamped >= 75 ? 'Hot' : clamped >= 50 ? 'Warm' : 'Standard';

  return {
    score: clamped,
    tier,
    factors,
  };
}
