import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Cpu,
  Database,
  Link2,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

type DocCategory =
  | 'User Manual'
  | 'Prob8 Underwriting'
  | 'AI & 1-Click Ollama'
  | 'State & Federal Regulations'
  | 'Privacy & Disclosures'
  | 'Affiliate & Admin Deployment';

interface DocSection {
  id: string;
  category: DocCategory;
  title: string;
  body: string;
  steps: string[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'discover-search',
    category: 'User Manual',
    title: '50-State + DC Initial Catalog, Discover Map & Free Tier Gating',
    body: 'Prob8 hydrates active probate filings and county auction parcels across all 50 US states plus Washington, D.C. right on initial load, with dynamic List and Map switching across Desktop, Tablet, and Mobile.',
    steps: [
      'Search any US State, County, City, or 5-digit ZIP Code in the Discover search bar or tap Near Me for instant GPS targeting.',
      'Urgency badges highlight filing windows: Filed <14 Days Ago (emerald), Prime Window 21-45 Days (amber), Motivated 90+ Days (rose), and Live Auction Scheduled (indigo).',
      'Free tier unlocks up to 2 full dossiers per county across every county nationwide with zero credit card required, clearly displaying how many active filings remain locked. Prob8 Pro ($79/mo after 7-day trial), VIP Lifetime, and Founder Admin unlock 100% on both Map and List.',
    ],
  },
  {
    id: 'courthouse-sync',
    category: 'User Manual',
    title: 'Automated Monday–Friday 11:00 AM & 3:00 PM Sync & Sold-Parcel Purge',
    body: 'Every weekday (Monday–Friday) at 11:00 AM ET and 3:00 PM ET, Prob8 runs an automated multi-county clerk sync, milestone status refresh, and dead-deal purge across all 51 jurisdictions (50 states + DC / 3,143 counties).',
    steps: [
      'Ingests newly docketed probate petitions, amended estate inventories, and newly posted sheriff/probate overbid auction dates.',
      'Automatically purges and archives sold, transferred, or dismissed estate listings so your Buy-Boxes and Discover feed never waste outreach on closed parcels.',
      'Founder Admin can also trigger an on-demand Manual County Sync & Purge at any time from the Executive Admin Dashboard.',
    ],
  },
  {
    id: 'media-lightbox',
    category: 'User Manual',
    title: 'Smart Property Media Carousel, Fullscreen Lightbox & Satellite',
    body: 'Prob8 resolves property photos using Zillow first (>3 photos), falling back to Redfin (>3 photos), or geocoded Google Street View + 19x Satellite parcel view when fewer than 4 photos exist.',
    steps: [
      'Click any thumbnail in the horizontal carousel directly below the enlarged dossier photo to jump to any frame.',
      'Tap Expand or the hero image to launch Fullscreen Lightbox mode (keyboard arrows, mouse buttons, or touch swipe on mobile).',
      'Active photo position stays synchronized when closing fullscreen back into the Property Dossier on Desktop, Tablet, and Mobile.',
    ],
  },
  {
    id: 'pipeline-crm-portfolio-route',
    category: 'User Manual',
    title: 'Empty-By-Default Workspaces: Pipeline, People CRM, Portfolio & Field Route',
    body: 'All five personal productivity modules start 100% clean per account under Row-Level Security so zero phantom demo rows pollute your deal flow.',
    steps: [
      'Pipeline Kanban tracks every prospect from Researching -> Contacted -> Offer Sent -> Under Contract -> Closed.',
      'People CRM maintains Executor, Heir, Attorney, and Buyer contacts with instant Skip Trace append and property linking.',
      'Owned Portfolio includes 5-digit US ZIP code lookup that auto-populates City & State (editable anytime) and calculates equity, debt service, monthly cash flow, and Cap Rate.',
      'Field Route Driving-for-Dollars pins your real GPS coordinates, logs property condition notes, and converts route pins directly into Pipeline deals.',
    ],
  },
  {
    id: 'prob8-underwriter',
    category: 'Prob8 Underwriting',
    title: 'Prob8 Multi-Strategy Underwriter Formulas (Fix & Flip, BRRRR, Hold, Wholesale)',
    body: 'Analyze single-family, multi-family, STRs, commercial assets, and mobile home parks with transparent institutional math inside every Property Dossier.',
    steps: [
      '70% Rule MAO = (ARV * 0.70) - Itemized Rehab Cost (or custom wholesale spread minus Assignment Fee).',
      'BRRRR Projection: Refinance Proceeds = ARV * Refi LTV%; Cash Left in Deal = (Purchase + Rehab + Closing) - Refinance Proceeds.',
      'Rental / Buy & Hold: Annual NOI = (Gross Monthly Rent * 12) - Operating Expenses; Cap Rate = (Annual NOI / All-In Cost) * 100; DSCR = Annual NOI / Annual P&I Debt Service.',
      'Mobile Home & Trailer Parks unlock pad-level underwriting combining Occupied Lot Rent, Park-Owned Home (POH) Rent, and Utility Expense Ratio %.',
    ],
  },
  {
    id: 'ai-and-email',
    category: 'AI & 1-Click Ollama',
    title: '1-Click Hardware-Matched Local Ollama, Free Gemini, WebLLM & Per-User Email',
    body: 'Run probate underwriting briefs, personalized scripts, and LOIs at $0 AI cost using either cloud free-tier or offline hardware-matched local AI.',
    steps: [
      'Settings -> 1-Click Local Ollama inspects your OS, CPU cores, and RAM (16GB+ -> prob8-realestate-8b; 8–15GB -> prob8-realestate-3b; <8GB -> prob8-realestate-1b).',
      'Clicking 1-Click Auto-Install Ollama & Model configures an active localhost:11434 daemon immediately or downloads a tailored 1-click installer script (.command / .ps1 / .sh).',
      'Connect your own Gmail, Outlook, Resend Free (3,000/mo), or Custom SMTP under Settings to dispatch outreach and LOIs directly from Engage & LOIs.',
    ],
  },
  {
    id: 'federal-tcpa-dnc',
    category: 'State & Federal Regulations',
    title: 'Federal TCPA, National DNC & CAN-SPAM Compliance Requirements',
    body: 'Real estate acquisitions involving phone calls, SMS text messages, and email outreach to estate representatives must strictly follow US federal statutes.',
    steps: [
      'Telephone Consumer Protection Act (TCPA): Restrict outbound solicitation calls and texts strictly between 8:00 AM and 9:00 PM recipient local time.',
      'National & State Do-Not-Call (DNC) Registries: Scrub skip-traced phone numbers against federal and state DNC lists before manual or automated dialing, and honor internal opt-outs immediately.',
      'CAN-SPAM Act: Commercial investor emails must use honest non-deceptive subject lines, identify a valid physical mailing address, and include a clear opt-out/unsubscribe instruction.',
    ],
  },
  {
    id: 'fair-housing-respa-wholesaling',
    category: 'State & Federal Regulations',
    title: 'Fair Housing Act, RESPA/TILA & State Wholesaling / Probate Overbid Laws',
    body: 'Federal non-discrimination mandates and state real estate licensing, assignment, and probate court rules apply nationwide.',
    steps: [
      'Fair Housing Act (42 U.S.C. § 3601): Strictly prohibit discriminatory targeting or marketing criteria based on race, color, religion, sex, disability, familial status, or national origin.',
      'Wholesaling & Equitable Interest Disclosures: States including IL, OK, SC, OR, and AZ regulate marketing properties you do not hold fee-simple title to—disclose equitable contract interest and never act as an unlicensed broker.',
      'Probate Court Confirmation & Waiting Periods: Independent administration states (e.g., TX, OH) often allow prompt executor signature once Letters issue, whereas Court-Supervised states (e.g., CA, NY) may mandate formal court confirmation and statutory overbid auctions.',
      'Prob8 recommends a respectful 7–14 day bereavement buffer after petition filing and embeds stage-calibrated Investor Tips & Contact Windows inside both Assessor & Probate and Engage & LOIs tabs.',
    ],
  },
  {
    id: 'privacy-and-notifications',
    category: 'Privacy & Disclosures',
    title: 'Zero-Data-Harvesting Guarantee, CCPA/CPRA & Notification Matrix',
    body: 'Your leads, skip-traced contacts, underwriting figures, and executed contracts remain strictly isolated inside your account.',
    steps: [
      'Supabase Row-Level Security (RLS) restricts every row in pipeline_deals, people, portfolio_assets, field_route_stops, buy_boxes, and documents to auth.uid() = user_id.',
      'Configure granular notification toggles in Settings for Web Push, Email Digests, Buy-Box matches, 24h Auction countdowns, TCPA Quiet-Hour prompts, and Sold-Parcel Purges.',
      'CCPA/CPRA compliance enables full data portability and permanent workspace deletion without selling personal consumer data.',
    ],
  },
  {
    id: 'affiliate-admin',
    category: 'Affiliate & Admin Deployment',
    title: '30% + $150 Affiliate Pay Plan, Zero-Key Infra & Google Play Checklist',
    body: 'Earn 30% recurring monthly ($23.70/mo) on Prob8 Pro ($79/mo) plus $150 flat on every $699 Prob8 Lifetime license, with 60-day attribution and $50 minimum monthly PayPal/ACH payouts.',
    steps: [
      'Register inside Become an Affiliate with your state of residence, payout method (PayPal/ACH), W-9/W-8BEN classification, FTC 16 CFR Part 255 certification, and electronic signature.',
      'Web Push VAPID keys auto-generate silently on boot and Built-In Skip Tracing pulls County Assessor, Voter Registry & Open OSINT records with zero third-party API keys.',
      'Payments route through Merchant-of-Record (Lemon Squeezy, Paddle) or Direct Merchant Processors (Square, Authorize.Net, PayPal Commerce) configurable inside Admin -> Financial & Accounting.',
      'Google Play Publishing Checklist: Build Capacitor bundle (com.prob8.app) via npm run build:android -> update /.well-known/assetlinks.json with Play App Signing SHA-256 -> sign .aab -> submit to Google Play Console Production track.',
    ],
  },
];

interface DocumentationViewProps {
  onOpenSupport?: () => void;
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({ onOpenSupport }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | DocCategory>('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DOC_SECTIONS.filter((sec) => {
      if (selectedCategory !== 'All' && sec.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.body.toLowerCase().includes(q) ||
        sec.steps.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [search, selectedCategory]);

  const categories: Array<'All' | DocCategory> = [
    'All',
    'User Manual',
    'Prob8 Underwriting',
    'AI & 1-Click Ollama',
    'State & Federal Regulations',
    'Privacy & Disclosures',
    'Affiliate & Admin Deployment',
  ];

  const getIcon = (cat: DocCategory) => {
    switch (cat) {
      case 'Prob8 Underwriting':
        return <Calculator className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />;
      case 'AI & 1-Click Ollama':
        return <Cpu className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'State & Federal Regulations':
        return <Scale className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'Privacy & Disclosures':
        return <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Affiliate & Admin Deployment':
        return <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <BookOpen className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />;
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[#0F766E] dark:text-emerald-400" />
            Prob8 Complete Platform Manual &amp; Regulatory Guide
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Searchable operations manual covering Prob8 Underwriting formulas, 1-Click Local Ollama, M–F 11 AM &amp; 3 PM ET courthouse sync, and Federal/State compliance laws.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search documentation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides, laws, formulas..."
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] pl-9 pr-3 text-sm text-slate-900 dark:text-white"
            />
          </div>
          {onOpenSupport && (
            <button
              type="button"
              onClick={onOpenSupport}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Contact, Suggestions &amp; Refunds
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((sec) => (
          <article
            key={sec.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {getIcon(sec.category)}
                {sec.category}
              </span>
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {sec.title}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{sec.body}</p>
            <ul className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-700 dark:text-slate-300">
              {sec.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#0F766E] dark:text-emerald-400">
                    {idx + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-[#111827] p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-sm font-bold">Mobile Field Deployment &amp; 50-State + DC Ready</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Prob8 ships as an installable iOS/Android PWA and Capacitor bundle (app.prob8.mobile) with offline Pipeline, CRM, Portfolio, and Field Route access.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
          <Database className="h-4 w-4" />
          <span>RLS Isolated · Zero Data Harvesting</span>
        </div>
      </section>
    </div>
  );
};
