import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingBuyBoxes, matchesBuyBoxFilters } from './buyBoxMatcher';
import type { BuyBox, PropertyRecord } from '../types';

const sampleProperty: PropertyRecord = {
  id: 'prop-1',
  apn: '010-044120',
  address: '418 Sycamore St',
  city: 'Columbus',
  state: 'OH',
  county: 'Franklin County',
  zip: '43206',
  lat: 39.951,
  lng: -82.987,
  propertyType: 'Single-Family',
  status: 'active',
  probatePrice: 285000,
  beds: 3,
  baths: 2,
  sqft: 1850,
  lotSqft: 6200,
  yearBuilt: 1924,
  probateCaseNumber: '2026-ES-00412',
  filingDate: '2026-10-18',
  courtName: 'Franklin County Probate Court',
  decedentName: 'Estate of Arthur Pendelton',
  executorName: 'Margaret Pendelton',
  executorMailingAddress: '712 Oakwood Ave, Columbus, OH 43205',
  probateAttorney: 'Vance & Associates LLP',
  assessorData: {
    assessedValue: 245000,
    landValue: 68000,
    improvementValue: 177000,
    annualTaxes: 4820,
    taxYear: 2026,
    lastSaleDate: '1998-06-12',
    lastSalePrice: 92000,
    zoning: 'R-2F',
    parcelClass: 'Residential 1-Family',
    legalDescription: 'LOT 42 GERMAN VILLAGE ADDN',
    taxDelinquencyAmount: 0,
    taxHistory: [{ year: 2026, assessed: 245000, taxPaid: 4820 }],
  },
  zillowData: { sourceUrl: '', estimate: 365000, status: 'Off-Market', photos: [] },
  redfinData: { sourceUrl: '', estimate: 362000, status: 'Off-Market', photos: [] },
  avmValue: 365000,
  estimatedEquity: 320000,
  equityPct: 87.7,
  mortgageBalance: 45000,
  taxDelinquent: false,
  isVacant: true,
  preForeclosureOverlap: false,
  comps: [],
  lastSyncedAt: '2026-11-12T10:00:00Z',
};

test('matchesBuyBoxFilters evaluates state, equity, beds, and vacancy criteria', () => {
  assert.equal(
    matchesBuyBoxFilters(sampleProperty, {
      states: ['OH', 'IN'],
      counties: ['Franklin'],
      cities: [],
      zips: [],
      propertyTypes: ['Single-Family'],
      minEquityPct: 60,
      minBeds: 3,
      vacantOnly: true,
    }),
    true
  );

  assert.equal(
    matchesBuyBoxFilters(sampleProperty, {
      states: ['AZ'],
      counties: [],
      cities: [],
      zips: [],
      propertyTypes: [],
    }),
    false
  );
});

test('findMatchingBuyBoxes ignores inactive buy boxes', () => {
  const boxes: BuyBox[] = [
    {
      id: 'bb-1',
      userId: 'u-1',
      name: 'Active Midwest SFR',
      isActive: true,
      filters: { states: ['OH'], counties: [], cities: [], zips: [], propertyTypes: ['Single-Family'], minEquityPct: 50 },
      alertPush: true,
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'bb-2',
      userId: 'u-1',
      name: 'Paused Box',
      isActive: false,
      filters: { states: ['OH'], counties: [], cities: [], zips: [], propertyTypes: [] },
      alertPush: false,
      createdAt: '2026-11-01T00:00:00Z',
    },
  ];

  const matched = findMatchingBuyBoxes(sampleProperty, boxes);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, 'bb-1');
});
