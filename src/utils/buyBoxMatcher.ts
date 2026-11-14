import type { BuyBox, BuyBoxFilters, PropertyRecord } from '../types';

export function matchesBuyBoxFilters(property: PropertyRecord, filters: BuyBoxFilters): boolean {
  if (filters.states.length > 0) {
    const normalized = filters.states.map((s) => s.trim().toUpperCase());
    if (!normalized.includes(property.state.toUpperCase())) return false;
  }

  if (filters.counties.length > 0) {
    const normalized = filters.counties.map((c) => c.trim().toLowerCase());
    const propCounty = property.county.toLowerCase();
    if (!normalized.some((c) => propCounty.includes(c))) return false;
  }

  if (filters.cities.length > 0) {
    const normalized = filters.cities.map((c) => c.trim().toLowerCase());
    if (!normalized.includes(property.city.toLowerCase())) return false;
  }

  if (filters.zips.length > 0) {
    const normalized = filters.zips.map((z) => z.trim());
    if (!normalized.includes(property.zip)) return false;
  }

  if (filters.propertyTypes.length > 0) {
    if (!filters.propertyTypes.includes(property.propertyType)) return false;
  }

  const assessed = property.assessorData.assessedValue;
  if (filters.minAssessedValue !== undefined && assessed < filters.minAssessedValue) return false;
  if (filters.maxAssessedValue !== undefined && assessed > filters.maxAssessedValue) return false;

  if (filters.minArv !== undefined && property.avmValue < filters.minArv) return false;
  if (filters.maxArv !== undefined && property.avmValue > filters.maxArv) return false;

  if (filters.minEquityPct !== undefined && property.equityPct < filters.minEquityPct) return false;
  if (filters.minEquityDollar !== undefined && property.estimatedEquity < filters.minEquityDollar) return false;

  if (filters.minBeds !== undefined && property.beds < filters.minBeds) return false;
  if (filters.minBaths !== undefined && property.baths < filters.minBaths) return false;
  if (filters.minSqft !== undefined && property.sqft < filters.minSqft) return false;
  if (filters.maxSqft !== undefined && property.sqft > filters.maxSqft) return false;
  if (filters.minLotSqft !== undefined && property.lotSqft < filters.minLotSqft) return false;
  if (filters.minYearBuilt !== undefined && property.yearBuilt < filters.minYearBuilt) return false;
  if (filters.maxYearBuilt !== undefined && property.yearBuilt > filters.maxYearBuilt) return false;

  if (filters.filingDateFrom && property.filingDate < filters.filingDateFrom) return false;
  if (filters.filingDateTo && property.filingDate > filters.filingDateTo) return false;

  if (filters.taxDelinquentOnly && !property.taxDelinquent) return false;
  if (filters.vacantOnly && !property.isVacant) return false;
  if (filters.preForeclosureOverlap && !property.preForeclosureOverlap) return false;

  return true;
}

export function findMatchingBuyBoxes(property: PropertyRecord, buyBoxes: BuyBox[]): BuyBox[] {
  return buyBoxes.filter((box) => box.isActive && matchesBuyBoxFilters(property, box.filters));
}
