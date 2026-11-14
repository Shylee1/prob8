import React, { useState } from 'react';
import { Briefcase, Building, Compass, Download, LayoutGrid, List, Trash2 } from 'lucide-react';
import { PIPELINE_STAGES, type PipelineDeal, type PipelineStage, type PropertyRecord, type SubscriptionTier } from '../types';
import { exportPipelineToCsv, formatCurrency, formatDateShort } from '../utils/formatters';

interface PipelineViewProps {
  deals: PipelineDeal[];
  subscriptionTier: SubscriptionTier;
  onSelectProperty: (property: PropertyRecord) => void;
  onUpdateStage: (dealId: string, stage: PipelineStage) => void;
  onRemoveDeal: (dealId: string) => void;
  onPromoteToPortfolio: (deal: PipelineDeal) => void;
  onGoToDiscover: () => void;
  onOpenUpgradeModal: () => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  deals,
  subscriptionTier,
  onSelectProperty,
  onUpdateStage,
  onRemoveDeal,
  onPromoteToPortfolio,
  onGoToDiscover,
  onOpenUpgradeModal,
}) => {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');

  const hasProAccess = subscriptionTier === 'pro' || subscriptionTier === 'vip_lifetime';

  const handleExportCsv = () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    const csv = exportPipelineToCsv(deals);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prob8-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (deals.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400">
          <Briefcase className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-slate-900 dark:text-white">
          Your Property Pipeline is Empty
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Search any US State, County, City, or Zip Code in Discover and save qualified probate parcels to track offers, Prob8 Underwriter MAO numbers, skip tracing, and court milestones.
        </p>
        <button
          type="button"
          onClick={onGoToDiscover}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-semibold text-white hover:bg-[#0D625B] transition-colors"
        >
          <Compass className="h-4 w-4" />
          Search National Probate Records
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Acquisitions Pipeline ({deals.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click any property card to open its full Dossier, review MAO &amp; Cash Flow, or move closed deals into Portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-1">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'board' ? 'bg-slate-900 dark:bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'table' ? 'bg-slate-900 dark:bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            return (
              <section
                key={stage}
                aria-label={stage}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0D1320] p-3.5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">{stage}</h2>
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {stageDeals.length}
                  </span>
                </div>

                {stageDeals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
                    No deals in this stage
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs space-y-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectProperty(deal.property)}
                          className="w-full text-left group"
                        >
                          <p className="font-display text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#0F766E] dark:group-hover:text-emerald-400 truncate">
                            {deal.property.address}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {deal.property.city}, {deal.property.state} · {deal.property.probateCaseNumber}
                          </p>
                          <p className="mt-1.5 font-mono text-xs font-semibold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                            AVM {formatCurrency(deal.property.avmValue)} · {deal.property.equityPct}% Eq
                          </p>
                          {(deal.maoEstimate !== undefined || deal.projectedCashFlow !== undefined) && (
                            <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                              {deal.maoEstimate !== undefined && `MAO ${formatCurrency(deal.maoEstimate)}`}
                              {deal.maoEstimate !== undefined && deal.projectedCashFlow !== undefined && ' · '}
                              {deal.projectedCashFlow !== undefined && `CF ${formatCurrency(deal.projectedCashFlow)}/mo`}
                            </p>
                          )}
                        </button>

                        <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                          <select
                            aria-label={`Change stage for ${deal.property.address}`}
                            value={deal.stage}
                            onChange={(e) => onUpdateStage(deal.id, e.target.value as PipelineStage)}
                            className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 text-xs text-slate-700 dark:text-slate-200"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => onPromoteToPortfolio(deal)}
                            title="Add to Owned Portfolio"
                            aria-label={`Add ${deal.property.address} to Portfolio`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#0F766E] dark:text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <Building className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveDeal(deal.id)}
                            aria-label={`Remove ${deal.property.address} from pipeline`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">County / Case</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">AVM</th>
                <th className="px-4 py-3 text-right">Est. Equity</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectProperty(deal.property)}
                      className="text-left font-semibold text-slate-900 dark:text-white hover:text-[#0F766E] dark:hover:text-emerald-400"
                    >
                      {deal.property.address}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {deal.property.city}, {deal.property.state} {deal.property.zip}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {deal.property.county} · <span className="font-mono">{deal.property.probateCaseNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Stage for ${deal.property.address}`}
                      value={deal.stage}
                      onChange={(e) => onUpdateStage(deal.id, e.target.value as PipelineStage)}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 text-xs font-medium text-slate-800 dark:text-white"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(deal.property.avmValue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                    {formatCurrency(deal.property.estimatedEquity)} ({deal.property.equityPct}%)
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateShort(deal.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
