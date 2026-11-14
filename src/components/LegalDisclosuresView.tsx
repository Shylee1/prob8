import React from 'react';
import { FileCheck2, Gavel, Lock, PhoneCall, Scale, ShieldAlert } from 'lucide-react';

export const LegalDisclosuresView: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="h-6 w-6 text-[#0F766E] dark:text-emerald-400" />
          Legal, Privacy &amp; State / Federal Regulatory Disclosures
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Effective Date: November 2026 · Applies to Prob8 Web, Progressive Web App (PWA), and Mobile Applications across all 50 US States &amp; D.C.
        </p>
      </div>

      {/* Zero-Data-Harvesting Banner */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/30 p-5 flex items-start gap-3">
        <Lock className="h-5 w-5 text-[#0F766E] dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Strict Zero-Data-Harvesting Guarantee
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Prob8 enforces Row-Level Security (RLS) across every Pipeline Deal, People CRM contact, Portfolio asset, Field Route pin, Buy-Box rule, and uploaded LOI/Contract. We never sell, rent, harvest, scrape, or cross-share your deal flow, skip-traced contacts, or underwriting assumptions with third-party buyers or data brokers.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
            1. Privacy Policy &amp; CCPA / CPRA Rights
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Under the California Consumer Privacy Act (CCPA) and CPRA, as well as comparable state privacy statutes (VA, CO, CT, UT, TX, FL), you retain the right to inspect what account data is stored, export your CRM/Pipeline records via CSV or JSON at any time, and permanently delete your workspace. Prob8 does NOT sell personal consumer information or embed third-party behavioral ad trackers.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            2. Terms of Service, Billing &amp; FTC Affiliate Compliance
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Free Tier ($0/mo) receives nationwide search with up to 5 full property dossiers per county (10 nationwide). Prob8 Pro ($79/mo with optional 7-day free trial) and Prob8 Lifetime ($699 one-time or Admin grant) unlock 100% of all 50 states + DC. Independent Affiliate Partners earn 30% recurring on Pro and $150 flat on Lifetime via PayPal/ACH ($50 minimum) under state-localized agreements, IRS W-9/W-8BEN, and FTC 16 CFR Part 255 disclosure mandates.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            3. Federal TCPA, National/State DNC &amp; CAN-SPAM Compliance
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            All users conducting phone, SMS, or email outreach via skip-traced estate contacts agree to comply strictly with the federal Telephone Consumer Protection Act (47 U.S.C. § 227), Federal Communications Commission (FCC) <strong>8:00 AM – 9:00 PM recipient local time</strong> calling windows, National and State Do-Not-Call (DNC) Registry scrubbing, immediate opt-out compliance (&ldquo;STOP&rdquo;), and CAN-SPAM physical address &amp; unsubscribe requirements.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gavel className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            4. Fair Housing Act, RESPA / TILA &amp; Wholesaling Laws
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Prob8 strictly mandates adherence to the federal Fair Housing Act (42 U.S.C. § 3601), Equal Credit Opportunity Act (ECOA), RESPA, and Truth in Lending Act (TILA). Investors engaging in contract assignments or novations must comply with applicable state real estate brokerage and wholesaling disclosure statutes (including IL, OK, SC, OR, AZ, VA, and TX equitable-interest notice laws) and never misrepresent themselves as licensed attorneys, brokers, or court officials.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            5. State Probate Court Waiting Periods, Overbids &amp; Auction Rules
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Probate real estate authority varies by jurisdiction: Independent Administration states may permit direct executor execution once Letters Testamentary/Administration are issued, while Dependent/Court-Supervised dockets (e.g., CA Probate Code §§ 10300+, NY Surrogate&apos;s Court, NC upset-bid windows) impose appraisal minimums, creditor notice periods (typically 3–6 months), and open-court confirmation overbid hearings. Always verify fiduciary authority and county auction deposit rules with licensed title counsel.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2.5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            6. Financial Underwriting &amp; Local AI Storage Disclosure
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Prob8 automated underwriting (70% Rule MAO, BRRRR, Cash Flow, Cap Rate, DSCR) and localized LOI/contract templates are provided for analytical workflow assistance only and do not constitute legal, tax, or investment advice. Strictly essential browser storage (<code className="font-mono">localStorage</code>) and optional user-selected on-device AI weights (WebLLM or local Ollama at <code className="font-mono">localhost:11434</code>) stay entirely on your device.
          </p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-2">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          7. Public Record, Automated Weekday Sync &amp; Mapping Attribution
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          County probate filings, tax assessments, parcel geometries, and sheriff/probate auction schedules originate from public county clerk and tax assessor dockets and are synced and purged for closed sales automatically Monday–Friday at 11:00 AM ET and 4:00 PM ET. Mapping, geocoding, satellite imagery, and interactive Street View panoramas are powered by Google Maps Platform. Third-party listing reference links remain the property of their respective portals.
        </p>
      </section>
    </div>
  );
};
