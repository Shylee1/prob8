import React, { useState } from 'react';
import {
  Bell,
  Compass,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  type BuyBox,
  type BuyBoxFilters,
  type PropertyRecord,
  type PropertyType,
} from '../types';
import { matchesBuyBoxFilters } from '../utils/buyBoxMatcher';
import { formatCurrency } from '../utils/formatters';

interface BuyBoxesViewProps {
  buyBoxes: BuyBox[];
  knownProperties: PropertyRecord[];
  onSaveBuyBox: (box: Omit<BuyBox, 'id' | 'userId' | 'createdAt'> & { id?: string }) => void;
  onToggleActive: (id: string) => void;
  onToggleAlertPush: (id: string) => void;
  onDeleteBuyBox: (id: string) => void;
  onApplyBuyBoxToSearch: (box: BuyBox) => void;
}

const PROPERTY_TYPES: PropertyType[] = [
  'Single-Family',
  'Multi-Family',
  'Short-Term Rental',
  'Condo/Townhouse',
  'Mobile Home / Trailer Park',
  'Land',
  'Commercial',
];

function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const BuyBoxesView: React.FC<BuyBoxesViewProps> = ({
  buyBoxes,
  knownProperties,
  onSaveBuyBox,
  onToggleActive,
  onToggleAlertPush,
  onDeleteBuyBox,
  onApplyBuyBoxToSearch,
}) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [statesRaw, setStatesRaw] = useState('');
  const [countiesRaw, setCountiesRaw] = useState('');
  const [citiesRaw, setCitiesRaw] = useState('');
  const [zipsRaw, setZipsRaw] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>(['Single-Family']);
  const [minAssessedValue, setMinAssessedValue] = useState('');
  const [maxAssessedValue, setMaxAssessedValue] = useState('');
  const [minArv, setMinArv] = useState('');
  const [maxArv, setMaxArv] = useState('');
  const [minEquityPct, setMinEquityPct] = useState('40');
  const [minEquityDollar, setMinEquityDollar] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [minBaths, setMinBaths] = useState('');
  const [minSqft, setMinSqft] = useState('');
  const [maxSqft, setMaxSqft] = useState('');
  const [minLotSqft, setMinLotSqft] = useState('');
  const [minYearBuilt, setMinYearBuilt] = useState('');
  const [maxYearBuilt, setMaxYearBuilt] = useState('');
  const [filingDateFrom, setFilingDateFrom] = useState('');
  const [filingDateTo, setFilingDateTo] = useState('');
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState(false);
  const [vacantOnly, setVacantOnly] = useState(false);
  const [preForeclosureOverlap, setPreForeclosureOverlap] = useState(false);
  const [alertPush, setAlertPush] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const openNewBuilder = () => {
    setEditingId(undefined);
    setName('');
    setIsActive(true);
    setStatesRaw('');
    setCountiesRaw('');
    setCitiesRaw('');
    setZipsRaw('');
    setPropertyTypes(['Single-Family']);
    setMinAssessedValue('');
    setMaxAssessedValue('');
    setMinArv('');
    setMaxArv('');
    setMinEquityPct('40');
    setMinEquityDollar('');
    setMinBeds('');
    setMinBaths('');
    setMinSqft('');
    setMaxSqft('');
    setMinLotSqft('');
    setMinYearBuilt('');
    setMaxYearBuilt('');
    setFilingDateFrom('');
    setFilingDateTo('');
    setTaxDelinquentOnly(false);
    setVacantOnly(false);
    setPreForeclosureOverlap(false);
    setAlertPush(true);
    setFormError(null);
    setShowBuilder(true);
  };

  const openEditBuilder = (box: BuyBox) => {
    const f = box.filters;
    setEditingId(box.id);
    setName(box.name);
    setIsActive(box.isActive);
    setStatesRaw(f.states.join(', '));
    setCountiesRaw(f.counties.join(', '));
    setCitiesRaw(f.cities.join(', '));
    setZipsRaw(f.zips.join(', '));
    setPropertyTypes(f.propertyTypes);
    setMinAssessedValue(f.minAssessedValue !== undefined ? String(f.minAssessedValue) : '');
    setMaxAssessedValue(f.maxAssessedValue !== undefined ? String(f.maxAssessedValue) : '');
    setMinArv(f.minArv !== undefined ? String(f.minArv) : '');
    setMaxArv(f.maxArv !== undefined ? String(f.maxArv) : '');
    setMinEquityPct(f.minEquityPct !== undefined ? String(f.minEquityPct) : '');
    setMinEquityDollar(f.minEquityDollar !== undefined ? String(f.minEquityDollar) : '');
    setMinBeds(f.minBeds !== undefined ? String(f.minBeds) : '');
    setMinBaths(f.minBaths !== undefined ? String(f.minBaths) : '');
    setMinSqft(f.minSqft !== undefined ? String(f.minSqft) : '');
    setMaxSqft(f.maxSqft !== undefined ? String(f.maxSqft) : '');
    setMinLotSqft(f.minLotSqft !== undefined ? String(f.minLotSqft) : '');
    setMinYearBuilt(f.minYearBuilt !== undefined ? String(f.minYearBuilt) : '');
    setMaxYearBuilt(f.maxYearBuilt !== undefined ? String(f.maxYearBuilt) : '');
    setFilingDateFrom(f.filingDateFrom ?? '');
    setFilingDateTo(f.filingDateTo ?? '');
    setTaxDelinquentOnly(Boolean(f.taxDelinquentOnly));
    setVacantOnly(Boolean(f.vacantOnly));
    setPreForeclosureOverlap(Boolean(f.preForeclosureOverlap));
    setAlertPush(box.alertPush);
    setFormError(null);
    setShowBuilder(true);
  };

  const toNum = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please name this Buy-Box profile.');
      return;
    }

    const filters: BuyBoxFilters = {
      states: parseCommaList(statesRaw).map((s) => s.toUpperCase()),
      counties: parseCommaList(countiesRaw),
      cities: parseCommaList(citiesRaw),
      zips: parseCommaList(zipsRaw),
      propertyTypes,
      minAssessedValue: toNum(minAssessedValue),
      maxAssessedValue: toNum(maxAssessedValue),
      minArv: toNum(minArv),
      maxArv: toNum(maxArv),
      minEquityPct: toNum(minEquityPct),
      minEquityDollar: toNum(minEquityDollar),
      minBeds: toNum(minBeds),
      minBaths: toNum(minBaths),
      minSqft: toNum(minSqft),
      maxSqft: toNum(maxSqft),
      minLotSqft: toNum(minLotSqft),
      minYearBuilt: toNum(minYearBuilt),
      maxYearBuilt: toNum(maxYearBuilt),
      filingDateFrom: filingDateFrom || undefined,
      filingDateTo: filingDateTo || undefined,
      taxDelinquentOnly,
      vacantOnly,
      preForeclosureOverlap,
    };

    onSaveBuyBox({
      id: editingId,
      name: name.trim(),
      isActive,
      filters,
      alertPush,
    });
    setShowBuilder(false);
  };

  const togglePropertyType = (pt: PropertyType) => {
    setPropertyTypes((prev) =>
      prev.includes(pt) ? prev.filter((item) => item !== pt) : [...prev, pt]
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Investor Buy-Boxes &amp; Free Web Push Alerts ({buyBoxes.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Run multiple acquisition profiles simultaneously with instant browser &amp; mobile Web Push notifications ($0 cost).
          </p>
        </div>

        <button
          type="button"
          onClick={openNewBuilder}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Buy-Box Profile
        </button>
      </div>

      {buyBoxes.length === 0 ? (
        <div className="mx-auto max-w-2xl py-12 px-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400">
            <SlidersHorizontal className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-slate-900 dark:text-white">
            No Saved Buy-Boxes Yet
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Configure target US states, counties, asset classes (including Mobile Home Parks &amp; STRs), minimum equity, and free Web Push notifications so matching probate filings alert you automatically.
          </p>
          <button
            type="button"
            onClick={openNewBuilder}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-semibold text-white hover:bg-[#0D625B]"
          >
            <Plus className="h-4 w-4" />
            Create First Buy-Box
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {buyBoxes.map((box) => {
            const matchesCount = knownProperties.filter((p) =>
              matchesBuyBoxFilters(p, box.filters)
            ).length;
            const marketSummary =
              [
                box.filters.states.join(', '),
                box.filters.counties.join(', '),
                box.filters.cities.join(', '),
                box.filters.zips.join(', '),
              ]
                .filter(Boolean)
                .join(' · ') || 'All US Markets';

            const criteriaSummary = [
              box.filters.propertyTypes.length > 0
                ? box.filters.propertyTypes.join(', ')
                : 'All Property Types',
              box.filters.minEquityPct !== undefined ? `≥${box.filters.minEquityPct}% Equity` : '',
              box.filters.minArv !== undefined ? `ARV ≥${formatCurrency(box.filters.minArv)}` : '',
              box.filters.maxArv !== undefined ? `ARV ≤${formatCurrency(box.filters.maxArv)}` : '',
              box.filters.taxDelinquentOnly ? 'Tax Delinquent' : '',
              box.filters.vacantOnly ? 'Vacant' : '',
              box.filters.preForeclosureOverlap ? 'Pre-Foreclosure' : '',
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <article
                key={box.id}
                className={`rounded-2xl border bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4 transition-all ${
                  box.isActive ? 'border-slate-200 dark:border-slate-800 shadow-2xs' : 'border-slate-200/70 dark:border-slate-800/60 opacity-75'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                        {box.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{marketSummary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleActive(box.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 ${
                        box.isActive
                          ? 'bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {box.isActive ? 'Active' : 'Paused'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{criteriaSummary}</p>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {matchesCount} current US {matchesCount === 1 ? 'match' : 'matches'}
                    </span>

                    <button
                      type="button"
                      onClick={() => onToggleAlertPush(box.id)}
                      aria-label={`Toggle Web Push alerts for ${box.name}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        box.alertPush
                          ? 'border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Bell className="h-3 w-3" />
                      {box.alertPush ? 'Web Push On' : 'Web Push Off'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => onApplyBuyBoxToSearch(box)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Compass className="h-3.5 w-3.5 text-[#5EEAD4] dark:text-white" />
                    Apply to Search
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditBuilder(box)}
                      aria-label={`Edit ${box.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBuyBox(box.id)}
                      aria-label={`Delete ${box.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showBuilder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Buy-Box Profile Builder"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Buy-Box Profile' : 'Create Investor Buy-Box Profile'}
              </h2>
              <button
                type="button"
                aria-label="Close Buy-Box builder"
                onClick={() => setShowBuilder(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
              {formError && (
                <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label htmlFor="bb-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Buy-Box Name *
                  </label>
                  <input
                    id="bb-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Midwest High-Equity Single Family"
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 accent-[#0F766E]"
                  />
                  Active Alert Monitoring
                </label>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Target Markets (Leave blank for Nationwide)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bb-states" className="block text-xs text-slate-600 dark:text-slate-400">
                      States (comma-separated, e.g., OH, AZ, FL)
                    </label>
                    <input
                      id="bb-states"
                      type="text"
                      value={statesRaw}
                      onChange={(e) => setStatesRaw(e.target.value)}
                      placeholder="OH, IN, NC"
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="bb-counties" className="block text-xs text-slate-600 dark:text-slate-400">
                      Counties (comma-separated)
                    </label>
                    <input
                      id="bb-counties"
                      type="text"
                      value={countiesRaw}
                      onChange={(e) => setCountiesRaw(e.target.value)}
                      placeholder="Franklin County, Maricopa County"
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="bb-cities" className="block text-xs text-slate-600 dark:text-slate-400">
                      Cities (comma-separated)
                    </label>
                    <input
                      id="bb-cities"
                      type="text"
                      value={citiesRaw}
                      onChange={(e) => setCitiesRaw(e.target.value)}
                      placeholder="Columbus, Phoenix"
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="bb-zips" className="block text-xs text-slate-600 dark:text-slate-400">
                      Zip Codes (comma-separated)
                    </label>
                    <input
                      id="bb-zips"
                      type="text"
                      value={zipsRaw}
                      onChange={(e) => setZipsRaw(e.target.value)}
                      placeholder="43206, 85016"
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">Property &amp; Asset Classes</h3>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map((pt) => {
                    const selected = propertyTypes.includes(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => togglePropertyType(pt)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selected
                            ? 'border-[#0F766E] bg-[#0F766E] text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {pt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Valuation &amp; Equity Thresholds
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ['bb-min-assessed', 'Min Assessed ($)', minAssessedValue, setMinAssessedValue],
                    ['bb-max-assessed', 'Max Assessed ($)', maxAssessedValue, setMaxAssessedValue],
                    ['bb-min-eq-pct', 'Min Equity (%)', minEquityPct, setMinEquityPct],
                    ['bb-min-arv', 'Min ARV ($)', minArv, setMinArv],
                    ['bb-max-arv', 'Max ARV ($)', maxArv, setMaxArv],
                    ['bb-min-eq-dollar', 'Min Equity ($)', minEquityDollar, setMinEquityDollar],
                  ].map(([id, label, val, setter]) => (
                    <div key={id as string}>
                      <label htmlFor={id as string} className="block text-xs text-slate-600 dark:text-slate-400">
                        {label as string}
                      </label>
                      <input
                        id={id as string}
                        type="number"
                        value={val as string}
                        onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                        className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">Property Specs</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['bb-beds', 'Min Beds', minBeds, setMinBeds],
                    ['bb-baths', 'Min Baths', minBaths, setMinBaths],
                    ['bb-min-sqft', 'Min SqFt', minSqft, setMinSqft],
                    ['bb-max-sqft', 'Max SqFt', maxSqft, setMaxSqft],
                    ['bb-lot', 'Min Lot SqFt', minLotSqft, setMinLotSqft],
                    ['bb-min-yr', 'Min Year Built', minYearBuilt, setMinYearBuilt],
                    ['bb-max-yr', 'Max Year Built', maxYearBuilt, setMaxYearBuilt],
                  ].map(([id, label, val, setter]) => (
                    <div key={id as string}>
                      <label htmlFor={id as string} className="block text-xs text-slate-600 dark:text-slate-400">
                        {label as string}
                      </label>
                      <input
                        id={id as string}
                        type="number"
                        value={val as string}
                        onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                        className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Probate &amp; Distress Indicators
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bb-from" className="block text-xs text-slate-600 dark:text-slate-400">Filing Date From</label>
                    <input id="bb-from" type="date" value={filingDateFrom} onChange={(e) => setFilingDateFrom(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label htmlFor="bb-to" className="block text-xs text-slate-600 dark:text-slate-400">Filing Date To</label>
                    <input id="bb-to" type="date" value={filingDateTo} onChange={(e) => setFilingDateTo(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={taxDelinquentOnly} onChange={(e) => setTaxDelinquentOnly(e.target.checked)} className="h-4 w-4 accent-[#0F766E]" />
                    Tax Delinquent Only
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={vacantOnly} onChange={(e) => setVacantOnly(e.target.checked)} className="h-4 w-4 accent-[#0F766E]" />
                    Vacant Only
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={preForeclosureOverlap} onChange={(e) => setPreForeclosureOverlap(e.target.checked)} className="h-4 w-4 accent-[#0F766E]" />
                    Pre-Foreclosure Overlap
                  </label>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Free Instant Web Push Notifications
                </h3>
                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                  <input type="checkbox" checked={alertPush} onChange={(e) => setAlertPush(e.target.checked)} className="h-4 w-4 accent-[#0F766E]" />
                  <span>Receive Instant Free Web Push Notifications when new probate matches post at 11:00 AM &amp; 3:00 PM</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[#0F766E] px-5 text-xs font-semibold text-white hover:bg-[#0D625B]"
                >
                  {editingId ? 'Save Buy-Box Updates' : 'Save Buy-Box Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
