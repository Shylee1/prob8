import React, { useMemo, useState } from 'react';
import { Building, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import type { PortfolioAsset, PropertyType } from '../types';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import { lookupUsZipCode, normalizeZip5, resolveZipSync } from '../utils/zipLookup';

interface PortfolioViewProps {
  assets: PortfolioAsset[];
  onAddAsset: (asset: Omit<PortfolioAsset, 'id' | 'userId' | 'createdAt'>) => void;
  onRemoveAsset: (id: string) => void;
}

const ASSET_CLASSES: PropertyType[] = [
  'Single-Family',
  'Multi-Family',
  'Short-Term Rental',
  'Condo/Townhouse',
  'Mobile Home / Trailer Park',
  'Land',
  'Commercial',
];

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  assets,
  onAddAsset,
  onRemoveAsset,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipHint, setZipHint] = useState<string | null>(null);
  const [assetClass, setAssetClass] = useState<PropertyType>('Single-Family');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [loanBalance, setLoanBalance] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [occupancyPct, setOccupancyPct] = useState('100');
  const [notes, setNotes] = useState('');

  const handleZipChange = async (raw: string) => {
    const cleaned = normalizeZip5(raw);
    setZip(cleaned);

    if (cleaned.length < 5) {
      setZipHint(null);
      return;
    }

    // Immediate synchronous prefix / table match for zero-latency UX
    const syncMatch = resolveZipSync(cleaned);
    if (syncMatch) {
      if (syncMatch.city) setCity(syncMatch.city);
      setState(syncMatch.state);
      setZipHint(
        syncMatch.city
          ? `Auto-filled ${syncMatch.city}, ${syncMatch.state} (${syncMatch.source})`
          : `Matched state ${syncMatch.state} — verifying city...`
      );
    }

    // Async exact US postal lookup refinement via /api/geo/zip/:zip
    const resolved = await lookupUsZipCode(cleaned);
    if (resolved) {
      if (resolved.city) setCity(resolved.city);
      setState(resolved.state);
      setZipHint(
        resolved.city
          ? `Auto-populated ${resolved.city}, ${resolved.state} from ZIP ${cleaned}`
          : `State ${resolved.state} auto-populated from ZIP ${cleaned}`
      );
    }
  };

  const metrics = useMemo(() => {
    const totalValue = assets.reduce((acc, a) => acc + a.currentValue, 0);
    const totalLoan = assets.reduce((acc, a) => acc + a.loanBalance, 0);
    const totalEquity = totalValue - totalLoan;
    const totalRent = assets.reduce((acc, a) => acc + a.monthlyRent, 0);
    const totalExpenses = assets.reduce((acc, a) => acc + a.monthlyExpenses, 0);
    const monthlyCashFlow = totalRent - totalExpenses;
    const weightedCapRate =
      totalValue > 0 ? (((totalRent - totalExpenses * 0.55) * 12) / totalValue) * 100 : 0;
    const avgOccupancy =
      assets.length > 0 ? assets.reduce((acc, a) => acc + a.occupancyPct, 0) / assets.length : 0;
    return {
      totalValue,
      totalLoan,
      totalEquity,
      monthlyCashFlow,
      weightedCapRate: Number(weightedCapRate.toFixed(2)),
      avgOccupancy: Number(avgOccupancy.toFixed(1)),
    };
  }, [assets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !city.trim() || !state.trim()) return;
    onAddAsset({
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim() || undefined,
      assetClass,
      acquisitionDate,
      purchasePrice: Number(purchasePrice) || 0,
      currentValue: Number(currentValue) || Number(purchasePrice) || 0,
      loanBalance: Number(loanBalance) || 0,
      monthlyRent: Number(monthlyRent) || 0,
      monthlyExpenses: Number(monthlyExpenses) || 0,
      occupancyPct: Number(occupancyPct) || 100,
      notes: notes.trim(),
    });
    setAddress('');
    setZip('');
    setCity('');
    setState('');
    setZipHint(null);
    setPurchasePrice('');
    setCurrentValue('');
    setLoanBalance('');
    setMonthlyRent('');
    setMonthlyExpenses('');
    setNotes('');
    setShowAddModal(false);
  };

  if (assets.length === 0 && !showAddModal) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400">
          <Building className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-slate-900 dark:text-white">
          Your Owned Portfolio is Empty
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Track owned Single-Family rentals, BRRRR refis, Short-Term Rentals, or Mobile Home Parks. Convert any closed Pipeline deal in one click or add an existing asset below.
        </p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-semibold text-white hover:bg-[#0D625B]"
        >
          <Plus className="h-4 w-4" />
          Add Owned Property
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0F766E] dark:text-emerald-400" />
            Portfolio Asset &amp; Cash-Flow Rollup ({assets.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time equity, debt service, monthly cash flow, occupancy %, and Cap Rate across your holdings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B]"
        >
          <Plus className="h-4 w-4" />
          Add Owned Asset
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Portfolio Value</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Equity</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#0F766E] dark:text-emerald-400 tabular-nums">
            {formatCurrency(metrics.totalEquity)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Debt</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalLoan)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Cash Flow</p>
          <p
            className={`mt-1 font-mono text-lg font-bold tabular-nums ${
              metrics.monthlyCashFlow >= 0 ? 'text-[#0F766E] dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {formatCurrency(metrics.monthlyCashFlow)}/mo
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cap Rate · Occupancy</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {metrics.weightedCapRate}% · {metrics.avgOccupancy}%
          </p>
        </div>
      </div>

      {/* Owned Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {assets.map((asset) => {
          const equity = asset.currentValue - asset.loanBalance;
          const netCash = asset.monthlyRent - asset.monthlyExpenses;
          return (
            <article
              key={asset.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                    {asset.address}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {asset.city}, {asset.state}
                    {asset.zip ? ` ${asset.zip}` : ''} · {asset.assetClass}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAsset(asset.id)}
                  aria-label={`Remove ${asset.address}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Value / Equity</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(asset.currentValue)} ·{' '}
                    <span className="text-[#0F766E] dark:text-emerald-400">{formatCurrency(equity)}</span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Net Cash Flow</span>
                  <p
                    className={`font-mono font-bold tabular-nums ${
                      netCash >= 0 ? 'text-[#0F766E] dark:text-emerald-400' : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(netCash)}/mo
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Acquired {formatDateShort(asset.acquisitionDate)} · Occupancy {asset.occupancyPct}%
              </p>
            </article>
          );
        })}
      </div>

      {/* Add Portfolio Asset Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Owned Asset"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Add Owned Property to Portfolio
              </h2>
              <button
                type="button"
                aria-label="Close Add Asset modal"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="portfolio-address" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Street Address *
                  </label>
                  <input
                    id="portfolio-address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="1420 Sycamore Ave"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="portfolio-asset-class" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Asset Class
                  </label>
                  <select
                    id="portfolio-asset-class"
                    value={assetClass}
                    onChange={(e) => setAssetClass(e.target.value as PropertyType)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 text-slate-900 dark:text-white"
                  >
                    {ASSET_CLASSES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="portfolio-zip" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Zip Code
                  </label>
                  <input
                    id="portfolio-zip"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={zip}
                    onChange={(e) => void handleZipChange(e.target.value)}
                    placeholder="43206"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="portfolio-city" className="block font-semibold text-slate-700 dark:text-slate-300">
                    City *
                  </label>
                  <input
                    id="portfolio-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Columbus"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="portfolio-state" className="block font-semibold text-slate-700 dark:text-slate-300">
                    State *
                  </label>
                  <input
                    id="portfolio-state"
                    type="text"
                    required
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="OH"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 uppercase text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="portfolio-acquired" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Acquired Date
                  </label>
                  <input
                    id="portfolio-acquired"
                    type="date"
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {zipHint && (
                <p className="text-[11px] font-medium text-[#0F766E] dark:text-emerald-400">
                  {zipHint}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Purchase Price ($)</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Current Value ($)</label>
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Loan Balance ($)</label>
                  <input
                    type="number"
                    value={loanBalance}
                    onChange={(e) => setLoanBalance(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Monthly Rent ($)</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Monthly Debt+Exp ($)</label>
                  <input
                    type="number"
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400">Occupancy (%)</label>
                  <input
                    type="number"
                    value={occupancyPct}
                    onChange={(e) => setOccupancyPct(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 px-4 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-xl bg-[#0F766E] px-5 font-semibold text-white hover:bg-[#0D625B]"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
