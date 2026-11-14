import React from 'react';
import { Building2, Compass, Gavel, MapPin } from 'lucide-react';
import type { PropertyRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { resolveSmartPropertyMedia } from '../utils/mediaGallery';
import { getProbateUrgencyBadge } from '../utils/probateTiming';

interface PropertyCardProps {
  property: PropertyRecord;
  isSelected: boolean;
  isSaved: boolean;
  matchedBuyBoxNames: string[];
  onOpenDossier: (property: PropertyRecord) => void;
}

const BADGE_CLASSES: Record<'emerald' | 'amber' | 'rose' | 'indigo', string> = {
  emerald: 'bg-emerald-500/12 text-[#0F766E] dark:text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  rose: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
  indigo: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
};

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  isSelected,
  isSaved,
  matchedBuyBoxNames,
  onOpenDossier,
}) => {
  const media = resolveSmartPropertyMedia(property.zillowData.photos, property.redfinData.photos);
  const urgency = getProbateUrgencyBadge(property.filingDate, property.status);

  return (
    <button
      type="button"
      onClick={() => onOpenDossier(property)}
      aria-label={`Open full property dossier for ${property.address}, ${property.city}, ${property.state}`}
      className={`group w-full text-left rounded-2xl border bg-white dark:bg-[#111827] p-4 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] ${
        isSelected
          ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15 shadow-sm'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
      }`}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Smart Media Preview (strict >3 photo threshold) */}
        <div className="relative h-40 sm:h-28 sm:w-36 shrink-0 overflow-hidden rounded-xl bg-slate-900">
          {media.mode === 'photos' ? (
            <img
              src={media.photos[0]}
              alt={`${property.address} exterior`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-3 text-center text-white">
              <Compass className="h-5 w-5 text-[#5EEAD4]" />
              <span className="mt-1.5 text-[11px] font-medium text-slate-200 leading-tight">
                Live Street View &amp; Satellite
              </span>
            </div>
          )}
          {property.status === 'auction' && property.auctionData && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-indigo-600/95 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              <Gavel className="h-2.5 w-2.5" />
              Bid {formatCurrency(property.auctionData.currentBid)}
            </span>
          )}
        </div>

        {/* Full-Card Information Hierarchy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-[#0F766E] dark:group-hover:text-emerald-400 transition-colors">
                {property.address}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">
                  {property.city}, {property.state} {property.zip} · {property.county}
                </span>
              </p>
            </div>
            <div className="text-right shrink-0 pl-1">
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                Est. {formatCurrency(property.avmValue)}
              </p>
              <p className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                Ask {formatCurrency(property.probatePrice)} · {property.equityPct}% Eq
              </p>
            </div>
          </div>

          {/* Urgency Badge + Specs */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${BADGE_CLASSES[urgency.tone]}`}
            >
              {urgency.label}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {property.propertyType}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{property.beds}bd/{property.baths}ba</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{property.sqft.toLocaleString()} sqft</span>
          </div>

          {/* Probate Case & Distress Row */}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
            <div className="text-slate-600 dark:text-slate-400 truncate min-w-0">
              <span className="font-mono text-slate-700 dark:text-slate-300">{property.probateCaseNumber}</span>
              {property.taxDelinquent && <span className="text-amber-600 dark:text-amber-400 font-semibold"> · Tax Delinq</span>}
              {property.isVacant && <span className="text-[#0F766E] dark:text-emerald-400 font-semibold"> · Vacant</span>}
              {property.preForeclosureOverlap && <span className="text-rose-600 dark:text-rose-400 font-semibold"> · Pre-FC</span>}
            </div>
            <span className="font-semibold text-[#0F766E] dark:text-emerald-400 shrink-0 whitespace-nowrap">
              {isSaved ? 'In Pipeline' : matchedBuyBoxNames.length > 0 ? `Matches ${matchedBuyBoxNames[0]}` : 'View Dossier'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
