import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Lock,
  Mail,
  Maximize2,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import {
  PIPELINE_STAGES,
  type DocumentRecord,
  type EmailConfig,
  type EngagementChannel,
  type EngagementRecord,
  type PersonRecord,
  type PipelineDeal,
  type PipelineStage,
  type PropertyRecord,
  type PropertyType,
  type SubscriptionTier,
} from '../types';
import { resolveSmartPropertyMedia } from '../utils/mediaGallery';
import {
  calculateUnderwriting,
  type InvestmentStrategy,
  type RehabLineItems,
  type TrailerParkInputs,
} from '../utils/underwriting';
import { getProbateUrgencyBadge } from '../utils/probateTiming';
import { buildLocalizedLoiTemplate, getCountyResourcesForProperty } from '../utils/countyResources';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import { StreetViewPanel } from './StreetViewPanel';

interface PropertyDossierModalProps {
  property: PropertyRecord;
  subscriptionTier: SubscriptionTier;
  userEmail: string;
  emailConfig?: EmailConfig;
  existingDeal: PipelineDeal | undefined;
  linkedPeople: Array<{ person: PersonRecord; relationshipType: string }>;
  allPeople: PersonRecord[];
  engagements: EngagementRecord[];
  documents: DocumentRecord[];
  onClose: () => void;
  onSaveToPipeline: (
    property: PropertyRecord,
    stage?: PipelineStage,
    underwritingPatch?: {
      arvEstimate?: number;
      rehabEstimate?: number;
      maoEstimate?: number;
      projectedCashFlow?: number;
      strategyLabel?: string;
    }
  ) => void;
  onUpdateDealStage: (dealId: string, stage: PipelineStage) => void;
  onLogEngagement: (input: {
    propertyId: string;
    personId?: string;
    channel: EngagementChannel;
    summary: string;
  }) => void;
  onSkipTraceProperty: (property: PropertyRecord) => Promise<void>;
  onLinkExistingPerson: (propertyId: string, personId: string, relationshipType: string) => void;
  onSaveDocument: (doc: {
    propertyId: string;
    docType: 'loi' | 'purchase_contract';
    title: string;
    content: string;
  }) => Promise<void>;
  onToggleWatchAuction: (propertyId: string) => void;
  onPlaceAuctionBid: (propertyId: string, bidAmount: number) => Promise<void>;
  onOpenPersonInCrm: (personId: string) => void;
  onOpenUpgradeModal: () => void;
}

type DossierTab = 'overview' | 'records' | 'underwriter' | 'engage' | 'resources';
type MediaMode = 'gallery' | 'streetview' | 'satellite';

const STRATEGIES: Array<{ id: InvestmentStrategy; label: string }> = [
  { id: 'flip', label: 'Fix & Flip' },
  { id: 'brrrr', label: 'BRRRR' },
  { id: 'rental', label: 'Buy & Hold' },
  { id: 'wholesale', label: 'Wholesale' },
];

const ASSET_CLASSES: PropertyType[] = [
  'Single-Family',
  'Multi-Family',
  'Short-Term Rental',
  'Condo/Townhouse',
  'Mobile Home / Trailer Park',
  'Land',
  'Commercial',
];

const ProbateComplianceGuidancePanel: React.FC<{ property: PropertyRecord }> = ({ property }) => {
  const daysSinceFiling = Math.max(
    1,
    Math.floor((Date.now() - new Date(property.filingDate).getTime()) / 86400000)
  );
  const hasCounsel = Boolean(property.probateAttorney && !/pro se/i.test(property.probateAttorney));

  const timingNote =
    property.status === 'auction'
      ? 'AUCTION STAGE: Verify court confirmation requirements, deposit cashier check rules, statutory redemption or overbid upset-bid periods, and municipal lien payoff before placing a bid.'
      : daysSinceFiling <= 14
        ? `EARLY FILING (${daysSinceFiling}d): Respect a 7–14 day family bereavement window before aggressive cold calling. Lead with low-pressure USPS empathy mail or counsel coordination first.`
        : daysSinceFiling <= 45
          ? `PRIME OUTREACH WINDOW (${daysSinceFiling}d): Letters Testamentary are typically active or pending. Executors are now evaluating repairs, cleanout quotes, and holding costs.`
          : `EXTENDED DOCKET (${daysSinceFiling}d): Estate has carried taxes, insurance, and utilities for 45+ days. Highlight fast as-is closing, zero cleanout burden, and lien payoff at closing.`;

  return (
    <section
      aria-label="Probate Investor Rules, Tips and Contact Windows"
      className="lg:col-span-12 rounded-2xl border border-amber-500/30 dark:border-amber-500/25 bg-amber-50/70 dark:bg-[#111827] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <h4 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Probate Investor Field Rules, Contact Windows &amp; Compliance Pointers ({property.state})
          </h4>
        </div>
        <span className="font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          Docket Age: {daysSinceFiling}d · {hasCounsel ? 'Attorney-Represented Estate' : 'Pro Se / Direct Personal Rep'}
        </span>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-white/80 dark:bg-[#090D16] p-3.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
        <span className="font-bold text-amber-800 dark:text-amber-300">Stage Strategy: </span>
        {timingNote}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] p-4 space-y-2">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400" />
            Permissible Contact Windows (TCPA)
          </p>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>• <strong>Statutory Quiet Hours:</strong> Only call or text between <strong>8:00 AM and 9:00 PM</strong> in the recipient&apos;s local time zone (strict federal TCPA limit).</li>
            <li>• <strong>Highest-Response Windows:</strong> Tuesday–Thursday <strong>10:00 AM–12:00 PM</strong> and <strong>4:00 PM–6:00 PM</strong> local time; Saturday <strong>10:30 AM–1:00 PM</strong> for working executors.</li>
            <li>• <strong>Avoid High-Friction Windows:</strong> Never cold call before 8:30 AM, during dinner (6:30–8:00 PM), Sundays, or within 7 days of the date of death.</li>
            <li>• <strong>Opt-Out Discipline:</strong> Honor verbal &ldquo;Do Not Call&rdquo; or SMS &ldquo;STOP&rdquo; immediately and scrub National/State DNC lists before automated dialing.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] p-4 space-y-2">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Court Authority &amp; Deal Verification
          </p>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>• <strong>Verify Letters Testamentary / Administration:</strong> Confirm the executor has legal authority to sign before advancing earnest money.</li>
            <li>• <strong>Independent vs. Dependent Probate:</strong> Court-supervised (dependent) estates may require formal court confirmation and statutory overbid hearings in open court.</li>
            <li>• <strong>Creditor Claim Window:</strong> Most states enforce a <strong>3–6 month creditor period</strong>; coordinate closing through a probate-experienced title company or escrow attorney.</li>
            <li>• <strong>Payoffs at Settlement:</strong> Mortgage arrears, HOA liens, and {formatCurrency(property.assessorData.taxDelinquencyAmount)} delinquent county taxes settle out of estate proceeds at closing.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] p-4 space-y-2">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            New Investor Pointers &amp; Disclosures
          </p>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>• <strong>Attorney Etiquette:</strong> When probate counsel ({property.probateAttorney}) is on record, lead with clean written proof-of-funds + 1-page LOI they can forward to all heirs.</li>
            <li>• <strong>No Legal Advice / Fee Transparency:</strong> Disclose in writing that you are a principal investor/buyer (not the court or estate counsel); comply with {property.state} wholesaling/novation disclosure rules.</li>
            <li>• <strong>Zero Pressure Empathy:</strong> Offer tangible relief—leave unwanted personal items behind, flexible move-out dates, and transparent closing net sheets.</li>
            <li>• <strong>Never Bypass Known Liens:</strong> Check Medicaid estate recovery, municipal code violations, and vacant-property insurance requirements early.</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

const SatelliteViewPanel: React.FC<{
  lat: number;
  lng: number;
  address: string;
}> = ({ lat, lng, address }) => {
  const map = useMap('dossier-satellite-map');
  const geocodingLib = useMapsLibrary('geocoding');
  const [resolvedPos, setResolvedPos] = useState<{ lat: number; lng: number }>({ lat, lng });

  useEffect(() => {
    setResolvedPos({ lat, lng });
  }, [lat, lng, address]);

  useEffect(() => {
    if (!geocodingLib || !address.trim() || address.startsWith('GPS ')) return;
    let cancelled = false;
    const geocoder = new geocodingLib.Geocoder();
    geocoder
      .geocode({ address })
      .then((res: { results?: Array<{ geometry?: { location?: { lat(): number; lng(): number } } }> }) => {
        const loc = res.results?.[0]?.geometry?.location;
        if (!cancelled && loc) {
          const gLat = loc.lat();
          const gLng = loc.lng();
          if (Math.hypot(gLat - lat, gLng - lng) < 0.25) {
            setResolvedPos({ lat: gLat, lng: gLng });
          }
        }
      })
      .catch(() => {
        // fallback cleanly to provided coords
      });
    return () => {
      cancelled = true;
    };
  }, [geocodingLib, address, lat, lng]);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId('hybrid');
    map.setCenter(resolvedPos);
    map.setZoom(19);
  }, [map, resolvedPos]);

  return (
    <div className="relative h-[340px] sm:h-[400px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <GoogleMap
        id="dossier-satellite-map"
        mapId="DEMO_MAP_ID"
        defaultCenter={resolvedPos}
        defaultZoom={19}
        mapTypeId="hybrid"
        gestureHandling="greedy"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={resolvedPos}>
          <Pin background="#0F766E" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      </GoogleMap>
      <div className="pointer-events-none absolute left-3 bottom-3 z-10 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
        Zoom 19x Parcel Lock · {address}
      </div>
    </div>
  );
};

export const PropertyDossierModal: React.FC<PropertyDossierModalProps> = ({
  property,
  subscriptionTier,
  userEmail,
  emailConfig,
  existingDeal,
  linkedPeople,
  allPeople,
  engagements,
  documents,
  onClose,
  onSaveToPipeline,
  onUpdateDealStage,
  onLogEngagement,
  onSkipTraceProperty,
  onLinkExistingPerson,
  onSaveDocument,
  onToggleWatchAuction,
  onPlaceAuctionBid,
  onOpenPersonInCrm,
  onOpenUpgradeModal,
}) => {
  const hasProAccess = subscriptionTier === 'pro' || subscriptionTier === 'vip_lifetime';
  const [activeTab, setActiveTab] = useState<DossierTab>('overview');

  const mediaResolution = useMemo(
    () => resolveSmartPropertyMedia(property.zillowData.photos, property.redfinData.photos),
    [property]
  );

  const [mediaMode, setMediaMode] = useState<MediaMode>(
    mediaResolution.mode === 'photos' ? 'gallery' : 'streetview'
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  const [isFullscreenLightbox, setIsFullscreenLightbox] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Keyboard navigation in Fullscreen Lightbox
  useEffect(() => {
    if (!isFullscreenLightbox || mediaResolution.photos.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreenLightbox(false);
      if (e.key === 'ArrowRight') {
        setPhotoIdx((i) => (i + 1) % mediaResolution.photos.length);
      }
      if (e.key === 'ArrowLeft') {
        setPhotoIdx((i) => (i - 1 + mediaResolution.photos.length) % mediaResolution.photos.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreenLightbox, mediaResolution.photos.length]);

  // Auction state
  const [auctionRegistered, setAuctionRegistered] = useState<boolean>(
    Boolean(property.auctionData?.isRegistered)
  );
  const [customBid, setCustomBid] = useState<number>(
    property.auctionData ? property.auctionData.currentBid + property.auctionData.bidIncrement : 0
  );
  const [bidNotice, setBidNotice] = useState<string | null>(null);
  const [isBidding, setIsBidding] = useState(false);

  // Prob8 Institutional Multi-Asset Underwriting State
  const [strategy, setStrategy] = useState<InvestmentStrategy>('flip');
  const [assetClass, setAssetClass] = useState<PropertyType>(property.propertyType);
  const [arv, setArv] = useState<number>(existingDeal?.arvEstimate ?? property.avmValue);
  const [purchaseOverride, setPurchaseOverride] = useState<string>(String(property.probatePrice));
  const [rehabItems, setRehabItems] = useState<RehabLineItems>({
    roofAndExterior: 8500,
    kitchenAndBaths: 14500,
    flooringAndPaint: 6500,
    hvacPlumbingElectrical: 5500,
    foundationAndPermits: 2000,
    contingency: 3000,
  });
  const [wholesaleBuffer, setWholesaleBuffer] = useState<number>(10000);
  const [assignmentFee, setAssignmentFee] = useState<number>(15000);
  const [holdingMonths, setHoldingMonths] = useState<number>(4);
  const [refiLtvPct, setRefiLtvPct] = useState<number>(75);
  const [monthlyRent, setMonthlyRent] = useState<number>(
    property.zillowData.rentEstimate ?? Math.round(property.avmValue * 0.0075)
  );
  const [trailerPark, setTrailerPark] = useState<TrailerParkInputs>({
    padCount: 16,
    lotRentPerPad: 425,
    parkOwnedHomesCount: 4,
    parkOwnedHomeRent: 750,
    utilityExpenseRatioPct: 22,
  });
  const [aiBrief, setAiBrief] = useState<string>('');
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);

  // Engagement, Email Dispatch & Scripts state
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [scripts, setScripts] = useState<{ coldCallScript: string; smsScript: string } | null>(null);
  const [isLoadingScripts, setIsLoadingScripts] = useState(false);
  const [logChannel, setLogChannel] = useState<EngagementChannel>('call');
  const [logSummary, setLogSummary] = useState('');
  const [mailTemplate, setMailTemplate] = useState('Probate Sensitive Empathy Letter');
  const [mailStatus, setMailStatus] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<string>(linkedPeople[0]?.person.emails[0]?.address ?? '');
  const [emailSubject, setEmailSubject] = useState<string>(
    `Estate Inquiry Regarding ${property.address}, ${property.city}`
  );
  const [emailBody, setEmailBody] = useState<string>(
    `Hello ${property.executorName},\n\nI am reaching out respectfully regarding the property at ${property.address} (${property.probateCaseNumber}). If your family is considering an as-is, flexible cash closing with no cleanout or commissions required, I would appreciate speaking briefly at your convenience.\n\nBest regards,\n${emailConfig?.fromName || userEmail}`
  );
  const [emailSendStatus, setEmailSendStatus] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [docType, setDocType] = useState<'loi' | 'purchase_contract'>('loi');
  const [offerPrice, setOfferPrice] = useState<number>(Math.round(property.avmValue * 0.62));
  const [generatedDoc, setGeneratedDoc] = useState<string>(() =>
    buildLocalizedLoiTemplate(property, Math.round(property.avmValue * 0.62))
  );
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [docSavedNotice, setDocSavedNotice] = useState<string | null>(null);
  const [selectedPersonToLink, setSelectedPersonToLink] = useState('');

  const underwriting = useMemo(
    () =>
      calculateUnderwriting({
        strategy,
        assetClass,
        purchasePriceOverride: Number(purchaseOverride) > 0 ? Number(purchaseOverride) : undefined,
        arv,
        rehabItems,
        wholesaleOrClosingBuffer: wholesaleBuffer,
        assignmentFeeTarget: assignmentFee,
        holdingMonths,
        monthlyHoldingCost: Math.round(arv * 0.0035),
        sellingCostPct: 7,
        monthlyRent,
        annualTaxes: property.assessorData.annualTaxes,
        annualInsurance: Math.round(arv * 0.0045),
        downPaymentPct: 20,
        interestRatePct: 6.85,
        loanTermYears: 30,
        refiLtvPct,
        vacancyPct: 5,
        managementPct: 8,
        capexMaintenancePct: 5,
        trailerPark: assetClass === 'Mobile Home / Trailer Park' ? trailerPark : undefined,
      }),
    [
      strategy,
      assetClass,
      purchaseOverride,
      arv,
      rehabItems,
      wholesaleBuffer,
      assignmentFee,
      holdingMonths,
      refiLtvPct,
      monthlyRent,
      trailerPark,
      property.assessorData.annualTaxes,
    ]
  );

  const urgency = useMemo(
    () => getProbateUrgencyBadge(property.filingDate, property.status),
    [property.filingDate, property.status]
  );

  const countyResources = useMemo(() => getCountyResourcesForProperty(property), [property]);

  const handleRunAiBrief = async () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    setIsLoadingBrief(true);
    try {
      const resp = await fetch('/api/ai/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property,
          strategy,
          mao70Rule: underwriting.mao70Rule,
          totalRehab: underwriting.totalRehab,
          monthlyCashFlow: underwriting.monthlyCashFlow,
          flipNetProfit: underwriting.flipNetProfit,
          dscr: underwriting.dscr,
        }),
      });
      const data = (await resp.json()) as { brief?: string };
      setAiBrief(data.brief || '');
    } finally {
      setIsLoadingBrief(false);
    }
  };

  const handleExportProformaReport = () => {
    const report = `PROB8 INVESTOR UNDERWRITING PROFORMA\nGenerated for: ${userEmail}\nProperty: ${property.address}, ${property.city}, ${property.state} ${property.zip}\nAsset Class: ${assetClass} | Strategy: ${strategy.toUpperCase()}\n\nVALUATION & OFFER\n- Estimated ARV: ${formatCurrency(arv)}\n- Probate Asking Price: ${formatCurrency(property.probatePrice)}\n- 70% Rule MAO: ${formatCurrency(underwriting.mao70Rule)}\n- Wholesale Target Offer: ${formatCurrency(underwriting.wholesaleMao)}\n- Total Rehab Budget: ${formatCurrency(underwriting.totalRehab)}\n\nCASH FLOW & RETURNS\n- Gross Monthly Income: ${formatCurrency(underwriting.grossMonthlyIncome)}\n- Monthly Debt + OpEx: ${formatCurrency(underwriting.totalMonthlyDebtAndExpenses)}\n- Net Monthly Cash Flow: ${formatCurrency(underwriting.monthlyCashFlow)}\n- Annual NOI: ${formatCurrency(underwriting.annualNOI)}\n- DSCR: ${underwriting.dscr} | Cap Rate: ${underwriting.capRatePct}% | Cash-on-Cash ROI: ${underwriting.cashOnCashRoiPct}%\n- Fix & Flip Net Profit: ${formatCurrency(underwriting.flipNetProfit)} (${underwriting.flipRoiPct}% ROI)\n- BRRRR Refi Proceeds: ${formatCurrency(underwriting.brrrrRefiProceeds)} | Cash Left In Deal: ${formatCurrency(underwriting.brrrrCashLeftInDeal)}\n- 5-Year Projected Combined Return: ${formatCurrency(underwriting.fiveYearEquityAndCashflow)}\n`;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prob8_Proforma_${property.address.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateScripts = async () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    setIsLoadingScripts(true);
    try {
      const resp = await fetch('/api/ai/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, tone: 'empathetic and consultative' }),
      });
      const data = (await resp.json()) as { coldCallScript: string; smsScript: string };
      setScripts(data);
    } finally {
      setIsLoadingScripts(false);
    }
  };

  const handleSkipTrace = async () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    setIsSkipTracing(true);
    try {
      await onSkipTraceProperty(property);
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleDispatchMail = async () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    const resp = await fetch('/api/direct-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientName: property.executorName,
        mailingAddress: property.executorMailingAddress,
        templateType: mailTemplate,
      }),
    });
    const data = (await resp.json()) as { trackingId?: string };
    setMailStatus(`Dispatched (${data.trackingId ?? 'Queued'})`);
    onLogEngagement({
      propertyId: property.id,
      channel: 'direct_mail',
      summary: `${mailTemplate} mailed to ${property.executorName} (${data.trackingId ?? 'USPS'})`,
    });
  };

  const handleGenerateLocalizedDocument = async () => {
    if (!hasProAccess) {
      onOpenUpgradeModal();
      return;
    }
    setIsGeneratingDoc(true);
    setDocSavedNotice(null);
    try {
      const resp = await fetch('/api/ai/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, docType, offerPrice, closingDays: 21 }),
      });
      const data = (await resp.json()) as { content?: string };
      const finalText = data.content || buildLocalizedLoiTemplate(property, offerPrice);
      setGeneratedDoc(finalText);
      await onSaveDocument({
        propertyId: property.id,
        docType,
        title: `${docType === 'loi' ? 'LOI' : `${property.state} Purchase Contract`} - ${property.address}`,
        content: finalText,
      });
      onLogEngagement({
        propertyId: property.id,
        channel: docType === 'loi' ? 'loi' : 'offer',
        summary: `Generated ${docType === 'loi' ? 'Letter of Intent' : `${property.state} Purchase Contract`} for ${formatCurrency(offerPrice)}`,
      });
      setDocSavedNotice('Saved to Property Documents & Cloud Storage');
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleDownloadDocument = () => {
    const blob = new Blob([generatedDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${property.address.replace(/\s+/g, '_')}_${docType}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitBid = async () => {
    if (!property.auctionData) return;
    if (!auctionRegistered) {
      setBidNotice('Verify your bidder registration checkbox before submitting a bid.');
      return;
    }
    setIsBidding(true);
    setBidNotice(null);
    try {
      await onPlaceAuctionBid(property.id, customBid);
      setBidNotice(`Live bid of ${formatCurrency(customBid)} submitted to ${property.auctionData.auctionPortalName}.`);
      setCustomBid(customBid + property.auctionData.bidIncrement);
    } finally {
      setIsBidding(false);
    }
  };

  const handleSendUserEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim()) {
      setEmailSendStatus('Enter a recipient email address first.');
      return;
    }
    const provider = emailConfig?.provider ?? 'mailto';
    if (provider === 'mailto') {
      const mailtoHref = `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.location.href = mailtoHref;
      onLogEngagement({
        propertyId: property.id,
        channel: 'email',
        summary: `Opened email draft to ${emailTo.trim()} (${emailSubject})`,
      });
      setEmailSendStatus('Opened default mail client & logged to property timeline.');
      return;
    }
    setIsSendingEmail(true);
    setEmailSendStatus(null);
    try {
      const resp = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          fromEmail: emailConfig?.fromEmail || userEmail,
          toEmail: emailTo.trim(),
          subject: emailSubject,
          body: emailBody,
          apiKeyOrPassword: emailConfig?.apiKeyOrPassword,
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; message?: string };
      setEmailSendStatus(data.message || `Email sent via ${provider.toUpperCase()}.`);
      onLogEngagement({
        propertyId: property.id,
        channel: 'email',
        summary: `Email sent via ${provider.toUpperCase()} to ${emailTo.trim()} (${emailSubject})`,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const tabs: Array<{ id: DossierTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview & Media', icon: <Compass className="h-4 w-4" /> },
    { id: 'records', label: 'Assessor & Probate', icon: <Landmark className="h-4 w-4" /> },
    { id: 'underwriter', label: 'Prob8 Underwriter', icon: <Calculator className="h-4 w-4" /> },
    { id: 'engage', label: 'Engage & LOIs', icon: <Send className="h-4 w-4" /> },
    { id: 'resources', label: 'County Resources', icon: <BookOpen className="h-4 w-4" /> },
  ];

  const unlinkedPeople = allPeople.filter((p) => !linkedPeople.some((lp) => lp.person.id === p.id));

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Property Dossier for ${property.address}`}
        className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-white transition-colors"
      >
        {/* Top Dossier Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 md:px-8 py-3.5">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">APN {property.apn}</span>
                <span aria-hidden="true">·</span>
                <span>{property.county}, {property.state}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{property.probateCaseNumber}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#0F766E] dark:text-emerald-400">{urgency.label}</span>
              </div>
              <h2 className="mt-0.5 font-display text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                {property.address}, {property.city}, {property.state} {property.zip}
              </h2>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {existingDeal ? (
                <select
                  aria-label="Pipeline Stage"
                  value={existingDeal.stage}
                  onChange={(e) => onUpdateDealStage(existingDeal.id, e.target.value as PipelineStage)}
                  className="h-10 rounded-xl border border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-500/15 px-3 text-xs font-semibold text-[#0F766E] dark:text-emerald-400 focus:outline-none"
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onSaveToPipeline(property, 'New Probate Lead', {
                      arvEstimate: arv,
                      rehabEstimate: underwriting.totalRehab,
                      maoEstimate: underwriting.mao70Rule,
                      projectedCashFlow: underwriting.monthlyCashFlow,
                      strategyLabel: strategy.toUpperCase(),
                    })
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] transition-colors whitespace-nowrap"
                >
                  <Briefcase className="h-4 w-4" />
                  Save to Pipeline
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Property Dossier"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mx-auto mt-3 flex max-w-[1440px] items-center gap-1 overflow-x-auto pb-0.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="mx-auto max-w-[1440px]">
            {/* TAB 1: OVERVIEW, MEDIA CAROUSEL & LIVE AUCTION HUB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        Visual Property Intelligence
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{mediaResolution.reason}</p>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-1">
                      {mediaResolution.mode === 'photos' && (
                        <button
                          type="button"
                          onClick={() => setMediaMode('gallery')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                            mediaMode === 'gallery' ? 'bg-[#0F766E] text-white' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Photos ({mediaResolution.photos.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMediaMode('streetview')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                          mediaMode === 'streetview' ? 'bg-[#0F766E] text-white' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Google Street View
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaMode('satellite')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                          mediaMode === 'satellite' ? 'bg-[#0F766E] text-white' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Satellite View
                      </button>
                    </div>
                  </div>

                  {mediaMode === 'gallery' && mediaResolution.mode === 'photos' ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900">
                        <img
                          src={mediaResolution.photos[photoIdx]}
                          alt={`${property.address} view ${photoIdx + 1}`}
                          onClick={() => setIsFullscreenLightbox(true)}
                          referrerPolicy="no-referrer"
                          className="h-[340px] sm:h-[400px] w-full object-cover cursor-zoom-in"
                        />
                        <button
                          type="button"
                          onClick={() => setIsFullscreenLightbox(true)}
                          aria-label="Open Fullscreen Photo Viewer"
                          className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-black/65 px-3 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/80"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          Fullscreen
                        </button>
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-3 text-white">
                          <span className="text-xs font-medium">
                            Source: {mediaResolution.selectedSource.toUpperCase()} · Photo {photoIdx + 1} of{' '}
                            {mediaResolution.photos.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Previous photo"
                              onClick={() =>
                                setPhotoIdx((i) => (i - 1 + mediaResolution.photos.length) % mediaResolution.photos.length)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Next photo"
                              onClick={() => setPhotoIdx((i) => (i + 1) % mediaResolution.photos.length)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Scrollable Thumbnail Carousel Underneath Enlarged Photo */}
                      <div
                        aria-label="Property Photo Thumbnail Carousel"
                        className="flex items-center gap-2.5 overflow-x-auto pb-1"
                      >
                        {mediaResolution.photos.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPhotoIdx(idx)}
                            aria-label={`Select photo ${idx + 1}`}
                            aria-pressed={photoIdx === idx}
                            className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition-all ${
                              photoIdx === idx
                                ? 'border-[#0F766E] ring-2 ring-[#0F766E] opacity-100'
                                : 'border-slate-200 dark:border-slate-800 opacity-65 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={src}
                              alt={`${property.address} thumbnail ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : mediaMode === 'satellite' ? (
                    <SatelliteViewPanel
                      lat={property.lat}
                      lng={property.lng}
                      address={`${property.address}, ${property.city}, ${property.state} ${property.zip}`}
                    />
                  ) : (
                    <StreetViewPanel
                      lat={property.lat}
                      lng={property.lng}
                      address={`${property.address}, ${property.city}, ${property.state} ${property.zip}`}
                      heightClass="h-[340px] sm:h-[400px]"
                    />
                  )}

                  {/* Live Auction Watch & In-App Bidding Hub */}
                  {property.auctionData && (
                    <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-[#111827] p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Gavel className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            {property.auctionData.auctionType} · {property.auctionData.auctionPortalName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Closes {formatDateShort(property.auctionData.endsAt)} · Deposit Required {formatCurrency(property.auctionData.depositRequired)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleWatchAuction(property.id)}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${
                            property.isWatchedAuction
                              ? 'bg-indigo-600 text-white'
                              : 'border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {property.isWatchedAuction ? 'Watching Live Auction' : 'Watch Live Auction'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                        <div className="rounded-xl bg-white dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 p-3">
                          <span className="font-sans text-slate-500 dark:text-slate-400">Opening Bid</span>
                          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(property.auctionData.openingBid)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 p-3">
                          <span className="font-sans text-slate-500 dark:text-slate-400">Current High Bid</span>
                          <p className="mt-0.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {formatCurrency(property.auctionData.currentBid)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 p-3">
                          <span className="font-sans text-slate-500 dark:text-slate-400">Bid Count</span>
                          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {property.auctionData.bidCount} ({property.auctionData.reserveMet ? 'Reserve Met' : 'Reserve Unmet'})
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {property.auctionData.rulesSummary}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 border-t border-indigo-500/20 pt-3">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={auctionRegistered}
                            onChange={(e) => setAuctionRegistered(e.target.checked)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          Confirm {formatCurrency(property.auctionData.depositRequired)} county bidder registration
                        </label>
                        <div className="flex items-center gap-2 ml-auto">
                          <input
                            type="number"
                            aria-label="In-app auction bid amount"
                            value={customBid}
                            onChange={(e) => setCustomBid(Number(e.target.value) || 0)}
                            className="w-28 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-xs text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            disabled={isBidding}
                            onClick={handleSubmitBid}
                            className="h-9 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500"
                          >
                            {isBidding ? 'Submitting...' : 'Place Bid'}
                          </button>
                        </div>
                      </div>
                      {bidNotice && (
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{bidNotice}</p>
                      )}
                    </section>
                  )}
                </div>

                {/* Right Valuation + Connected People */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Valuation, Probate Pricing &amp; Equity Snapshot
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">AVM Estimated Value</p>
                        <p className="mt-0.5 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(property.avmValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Probate Asking Price</p>
                        <p className="mt-0.5 font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {formatCurrency(property.probatePrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Equity</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                          {formatCurrency(property.estimatedEquity)} ({property.equityPct}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Est. Mortgage / Liens</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatCurrency(property.mortgageBalance)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-white">Specs:</span> {property.propertyType} ·{' '}
                        {property.beds} bd / {property.baths} ba · {property.sqft.toLocaleString()} sqft · Built {property.yearBuilt}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-white">Probate Court:</span> {property.courtName} (Filed{' '}
                        {formatDateShort(property.filingDate)})
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-white">Executor:</span> {property.executorName} ·{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">Attorney:</span> {property.probateAttorney}
                      </p>
                    </div>
                  </div>

                  {/* Full Zillow & Redfin Listing Intelligence on Overview */}
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        Zillow &amp; Redfin Listing Intelligence
                      </h3>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <a
                          href={property.zillowData.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0F766E] dark:text-emerald-400 hover:underline"
                        >
                          Zillow <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href={property.redfinData.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Redfin <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 dark:bg-[#090D16] p-3">
                        <dt className="text-slate-500 dark:text-slate-400">Zestimate</dt>
                        <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(property.zillowData.estimate)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#090D16] p-3">
                        <dt className="text-slate-500 dark:text-slate-400">Redfin Estimate</dt>
                        <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(property.redfinData.estimate)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#090D16] p-3">
                        <dt className="text-slate-500 dark:text-slate-400">Rent Zestimate</dt>
                        <dd className="mt-0.5 font-mono text-sm font-bold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                          {formatCurrency(property.zillowData.rentEstimate ?? Math.round(property.avmValue * 0.0075))}/mo
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#090D16] p-3">
                        <dt className="text-slate-500 dark:text-slate-400">Price / SqFt</dt>
                        <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          ${property.zillowData.pricePerSqft ?? Math.round(property.avmValue / Math.max(1, property.sqft))}/sf
                        </dd>
                      </div>
                    </dl>

                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Listing Status</dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200">{property.zillowData.status}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Days Tracked / DOM</dt>
                        <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {property.zillowData.daysOnMarket ?? 18} days
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">HOA Fee</dt>
                        <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {property.zillowData.hoaFeeMonthly ? `${formatCurrency(property.zillowData.hoaFeeMonthly)}/mo` : '$0 / No HOA'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Heating &amp; Cooling</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {property.zillowData.heatingCooling ?? 'Central Forced Air / Heat Pump'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Parking &amp; Garage</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {property.zillowData.parking ?? 'Attached 2-Car Garage'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Construction</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {property.zillowData.constructionType ?? 'Brick & Frame · Architectural Shingle'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">School District</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {property.zillowData.schoolDistrict ?? `${property.city} Public Schools`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Walk Score</dt>
                        <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {property.redfinData.walkScore ?? 68} / 100
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Prior Transfer</dt>
                        <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          {property.zillowData.lastSoldDate || property.assessorData.lastSaleDate} (
                          {formatCurrency(property.zillowData.lastSoldPrice ?? property.assessorData.lastSalePrice)})
                        </dd>
                      </div>
                    </dl>

                    {property.zillowData.propertyDescription && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                        {property.zillowData.propertyDescription}
                      </p>
                    )}
                  </section>

                  {/* Connected People */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        Connected People ({linkedPeople.length})
                      </h3>
                      <button
                        type="button"
                        onClick={handleSkipTrace}
                        disabled={isSkipTracing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        {!hasProAccess ? (
                          <Lock className="h-3.5 w-3.5 text-amber-300" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-[#5EEAD4] dark:text-white" />
                        )}
                        {isSkipTracing
                          ? 'Tracing...'
                          : hasProAccess
                            ? 'Skip Trace Executor'
                            : 'Skip Trace Executor (Pro)'}
                      </button>
                    </div>

                    {linkedPeople.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        No contacts linked yet. Run Skip Trace or link an existing contact from your People CRM below.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                        {linkedPeople.map(({ person, relationshipType }) => (
                          <li key={person.id} className="py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{person.fullName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {relationshipType}
                                {person.phones[0] && ` · ${person.phones[0].number}`}
                                {person.emails[0] && ` · ${person.emails[0].address}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenPersonInCrm(person.id)}
                              className="text-xs font-semibold text-[#0F766E] dark:text-emerald-400 hover:underline shrink-0"
                            >
                              Open Contact
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {unlinkedPeople.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <select
                          aria-label="Link existing contact"
                          value={selectedPersonToLink}
                          onChange={(e) => setSelectedPersonToLink(e.target.value)}
                          className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="">Link existing contact from CRM...</option>
                          {unlinkedPeople.map((p) => (
                            <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedPersonToLink}
                          onClick={() => {
                            const p = unlinkedPeople.find((u) => u.id === selectedPersonToLink);
                            if (p) {
                              onLinkExistingPerson(property.id, p.id, p.role);
                              setSelectedPersonToLink('');
                            }
                          }}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FULL COUNTY ASSESSOR & PROBATE COURT */}
            {activeTab === 'records' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Full County Assessor &amp; Tax Roll Profile
                  </h3>
                  <dl className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Assessor Parcel Number (APN)</dt>
                      <dd className="font-mono font-semibold text-slate-900 dark:text-white">{property.apn}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Zoning / Land Use Code</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {property.assessorData.zoning} · {property.assessorData.landUseCode ?? property.assessorData.parcelClass}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Full County Market Appraisal</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatCurrency(property.assessorData.marketAppraisalValue ?? property.avmValue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Assessed Total ({property.assessorData.taxYear})</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatCurrency(property.assessorData.assessedValue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Land vs. Improvement Value</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatCurrency(property.assessorData.landValue)} / {formatCurrency(property.assessorData.improvementValue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Annual Tax / Millage Rate</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatCurrency(property.assessorData.annualTaxes)} ({property.assessorData.millageRate ?? 'Standard Millage'})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Deed Book &amp; Page / Transfer</dt>
                      <dd className="font-mono font-medium">
                        {property.assessorData.deedBookPage ?? 'On County Recorder'} · {formatDateShort(property.assessorData.lastSaleDate)} ({formatCurrency(property.assessorData.lastSalePrice)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Subdivision / Township</dt>
                      <dd className="font-medium">
                        {property.assessorData.subdivision ?? property.city} · {property.assessorData.township ?? property.county}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Parcel Map Page / Homestead</dt>
                      <dd className="font-medium">
                        {property.assessorData.parcelMapPage ?? 'Plat Book Active'} ·{' '}
                        {property.assessorData.homesteadExemption ? 'Homestead Active' : 'No Homestead'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Tax Delinquency Balance</dt>
                      <dd className={`font-mono font-bold tabular-nums ${property.assessorData.taxDelinquencyAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#0F766E] dark:text-emerald-400'}`}>
                        {formatCurrency(property.assessorData.taxDelinquencyAmount)}
                        {property.assessorData.delinquentYears && property.assessorData.delinquentYears !== 'Current'
                          ? ` (${property.assessorData.delinquentYears})`
                          : ' (Current)'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Recorded Legal Description</dt>
                      <dd className="font-mono text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                        {property.assessorData.legalDescription}
                      </dd>
                    </div>
                  </dl>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Assessment History</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                          <th className="py-1.5">Tax Year</th>
                          <th className="py-1.5 text-right">Assessed</th>
                          <th className="py-1.5 text-right">Tax Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                        {property.assessorData.taxHistory.map((row) => (
                          <tr key={row.year}>
                            <td className="py-1.5">{row.year}</td>
                            <td className="py-1.5 text-right">{formatCurrency(row.assessed)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(row.taxPaid)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Full Probate Court Docket Intelligence
                    </h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Probate Case Number</dt>
                        <dd className="font-mono font-semibold">{property.probateCaseNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Petition Filing / Next Hearing</dt>
                        <dd className="font-semibold">
                          {formatDateShort(property.filingDate)}
                          {property.hearingDate ? ` · Hearing ${formatDateShort(property.hearingDate)}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Court &amp; Division</dt>
                        <dd className="font-semibold">
                          {property.courtName} ({property.courtDivision ?? 'Estates & Fiduciary Division'})
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Presiding Probate Judge</dt>
                        <dd className="font-medium">{property.judgeName ?? 'County Probate Division'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Fiduciary Bond / Estate Inventory</dt>
                        <dd className="font-mono font-semibold tabular-nums">
                          Bond {formatCurrency(property.bondAmount ?? 15000)} · Estate {formatCurrency(property.estateInventoryValue ?? property.avmValue)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Decedent &amp; Date of Death</dt>
                        <dd className="font-medium">
                          {property.decedentName}
                          {property.decedentDateOfDeath ? ` (DOD ${formatDateShort(property.decedentDateOfDeath)})` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Executor / Personal Rep</dt>
                        <dd className="font-medium">{property.executorName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Probate Counsel &amp; Direct Line</dt>
                        <dd className="font-medium">
                          {property.probateAttorney}
                          {property.attorneyPhone ? ` · ${property.attorneyPhone}` : ''}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Executor Registered Mailing Address</dt>
                        <dd className="font-mono text-xs">{property.executorMailingAddress}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-3">
                      Nearby Sold Comparables
                    </h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                          <th className="py-2">Address</th>
                          <th className="py-2 text-right">SqFt</th>
                          <th className="py-2 text-right">Price</th>
                          <th className="py-2 text-right">$/SqFt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {property.comps.map((comp, idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-medium">{comp.address}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{comp.sqft.toLocaleString()}</td>
                            <td className="py-2 text-right font-mono font-semibold tabular-nums">
                              {formatCurrency(comp.soldPrice)}
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums">${comp.pricePerSqft}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <ProbateComplianceGuidancePanel property={property} />
                </div>
              </div>
            )}

            {/* TAB 3: PROB8 INSTITUTIONAL MULTI-ASSET & MULTI-STRATEGY UNDERWRITER */}
            {activeTab === 'underwriter' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Prob8 Multi-Asset &amp; Exit Strategy Underwriter
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Switch strategies or asset classes (including Mobile Home Parks &amp; BRRRR) for live institutional math.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAiBrief}
                      disabled={isLoadingBrief}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#5EEAD4] dark:text-white" />
                      {isLoadingBrief ? 'Analyzing...' : 'Generate AI Deal Brief'}
                    </button>
                  </div>

                  {/* Strategy Selector + Asset Class */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 dark:border-slate-800 py-3">
                    <div className="inline-flex flex-wrap rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-[#090D16] gap-1">
                      {STRATEGIES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStrategy(s.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            strategy === s.id
                              ? 'bg-[#0F766E] text-white'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <select
                      aria-label="Asset Class"
                      value={assetClass}
                      onChange={(e) => setAssetClass(e.target.value as PropertyType)}
                      className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {ASSET_CLASSES.map((ac) => (
                        <option key={ac} value={ac}>{ac}</option>
                      ))}
                    </select>
                  </div>

                  {aiBrief && (
                    <div className="rounded-xl border border-[#0F766E]/25 bg-[#0F766E]/5 dark:bg-emerald-950/30 p-4 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {aiBrief}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="uw-arv" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        After Repair Value (ARV)
                      </label>
                      <input
                        id="uw-arv"
                        type="number"
                        value={arv}
                        onChange={(e) => setArv(Number(e.target.value) || 0)}
                        className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="uw-purchase" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Target Offer Price ($)
                      </label>
                      <input
                        id="uw-purchase"
                        type="number"
                        value={purchaseOverride}
                        onChange={(e) => setPurchaseOverride(e.target.value)}
                        className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-sm tabular-nums"
                      />
                    </div>
                    {assetClass !== 'Mobile Home / Trailer Park' ? (
                      <div>
                        <label htmlFor="uw-rent" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Est. Monthly Rent ($)
                        </label>
                        <input
                          id="uw-rent"
                          type="number"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)}
                          className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-sm tabular-nums"
                        />
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="uw-pads" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Occupied Pads
                        </label>
                        <input
                          id="uw-pads"
                          type="number"
                          value={trailerPark.padCount}
                          onChange={(e) =>
                            setTrailerPark((p) => ({ ...p, padCount: Number(e.target.value) || 0 }))
                          }
                          className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-sm tabular-nums"
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile Home / Trailer Park Specialized Inputs */}
                  {assetClass === 'Mobile Home / Trailer Park' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-800 dark:text-amber-300">
                        Mobile Home / Trailer Park Unit Economics
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400">Lot Rent / Pad ($)</label>
                          <input
                            type="number"
                            value={trailerPark.lotRentPerPad}
                            onChange={(e) => setTrailerPark((p) => ({ ...p, lotRentPerPad: Number(e.target.value) || 0 }))}
                            className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400">Park-Owned Homes</label>
                          <input
                            type="number"
                            value={trailerPark.parkOwnedHomesCount}
                            onChange={(e) =>
                              setTrailerPark((p) => ({ ...p, parkOwnedHomesCount: Number(e.target.value) || 0 }))
                            }
                            className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400">POH Rent ($/unit)</label>
                          <input
                            type="number"
                            value={trailerPark.parkOwnedHomeRent}
                            onChange={(e) =>
                              setTrailerPark((p) => ({ ...p, parkOwnedHomeRent: Number(e.target.value) || 0 }))
                            }
                            className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400">Utility Ratio (%)</label>
                          <input
                            type="number"
                            value={trailerPark.utilityExpenseRatioPct}
                            onChange={(e) =>
                              setTrailerPark((p) => ({ ...p, utilityExpenseRatioPct: Number(e.target.value) || 0 }))
                            }
                            className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strategy-specific sliders/inputs */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400">Closing / Fee Buffer ($)</label>
                      <input
                        type="number"
                        value={wholesaleBuffer}
                        onChange={(e) => setWholesaleBuffer(Number(e.target.value) || 0)}
                        className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400">
                        {strategy === 'brrrr' ? 'BRRRR Refi LTV (%)' : strategy === 'wholesale' ? 'Assignment Target ($)' : 'Flip Hold Months'}
                      </label>
                      {strategy === 'brrrr' ? (
                        <input
                          type="number"
                          value={refiLtvPct}
                          onChange={(e) => setRefiLtvPct(Number(e.target.value) || 75)}
                          className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                        />
                      ) : strategy === 'wholesale' ? (
                        <input
                          type="number"
                          value={assignmentFee}
                          onChange={(e) => setAssignmentFee(Number(e.target.value) || 0)}
                          className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                        />
                      ) : (
                        <input
                          type="number"
                          value={holdingMonths}
                          onChange={(e) => setHoldingMonths(Number(e.target.value) || 4)}
                          className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                        />
                      )}
                    </div>
                    <div>
                      <span className="block text-slate-600 dark:text-slate-400">Total Rehab Scope</span>
                      <p className="mt-1 h-9 flex items-center font-mono text-sm font-bold text-[#0F766E] dark:text-emerald-400">
                        {formatCurrency(underwriting.totalRehab)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Itemized Rehab Line Items
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(
                        [
                          ['roofAndExterior', 'Roof & Exterior'],
                          ['kitchenAndBaths', 'Kitchen & Baths'],
                          ['flooringAndPaint', 'Flooring & Paint'],
                          ['hvacPlumbingElectrical', 'HVAC / MEP'],
                          ['foundationAndPermits', 'Foundation / Permits'],
                          ['contingency', 'Contingency'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label htmlFor={`rehab-${key}`} className="block text-xs text-slate-500 dark:text-slate-400">
                            {label}
                          </label>
                          <input
                            id={`rehab-${key}`}
                            type="number"
                            value={rehabItems[key]}
                            onChange={(e) =>
                              setRehabItems((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
                            }
                            className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono text-xs tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Prob8 Underwriter Output Card */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Proforma Output ({strategy.toUpperCase()})
                    </h3>
                    <button
                      type="button"
                      onClick={handleExportProformaReport}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Report
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-900 dark:bg-[#090D16] border border-slate-800 p-5 text-white">
                    <p className="text-xs text-slate-300">
                      {strategy === 'wholesale'
                        ? 'Wholesale Max Buyer Offer (MAO)'
                        : '70% Rule Max Allowable Offer (MAO)'}
                    </p>
                    <p className="mt-1 font-mono text-3xl font-bold text-[#5EEAD4] tabular-nums">
                      {formatCurrency(strategy === 'wholesale' ? underwriting.wholesaleMao : underwriting.mao70Rule)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300 tabular-nums">
                      {underwriting.estimatedOfferPctOfArv}% of ARV · Gross Spread {formatCurrency(underwriting.spreadToArv)}
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 pt-1 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Net Monthly Cash Flow</dt>
                      <dd
                        className={`font-mono text-lg font-bold tabular-nums ${
                          underwriting.monthlyCashFlow >= 0 ? 'text-[#0F766E] dark:text-emerald-400' : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(underwriting.monthlyCashFlow)}/mo
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">DSCR / Cap Rate</dt>
                      <dd className="font-mono text-lg font-bold tabular-nums">
                        {underwriting.dscr}x · {underwriting.capRatePct}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Fix &amp; Flip Net Profit</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(underwriting.flipNetProfit)} ({underwriting.flipRoiPct}% ROI)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">BRRRR Cash Left In</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(underwriting.brrrrCashLeftInDeal)} (Refi {formatCurrency(underwriting.brrrrRefiProceeds)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Cash-on-Cash ROI</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums">
                        {underwriting.cashOnCashRoiPct}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">5-Yr Combined Return</dt>
                      <dd className="font-mono text-sm font-semibold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                        {formatCurrency(underwriting.fiveYearEquityAndCashflow)}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => {
                      setOfferPrice(underwriting.mao70Rule);
                      setActiveTab('engage');
                    }}
                    className="w-full h-11 rounded-xl bg-[#0F766E] text-sm font-semibold text-white hover:bg-[#0D625B]"
                  >
                    Draft LOI at {formatCurrency(underwriting.mao70Rule)}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: ENGAGEMENT, AI SCRIPTS & LOCALIZED LOI */}
            {activeTab === 'engage' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        AI Probate Outreach Scripts
                      </h3>
                      <button
                        type="button"
                        onClick={handleGenerateScripts}
                        disabled={isLoadingScripts}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#5EEAD4] dark:text-white" />
                        {isLoadingScripts ? 'Writing...' : 'Tailor Scripts (Pro)'}
                      </button>
                    </div>

                    {scripts ? (
                      <div className="space-y-3 text-xs">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5">
                          <p className="font-semibold mb-1">Cold-Call Script</p>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {scripts.coldCallScript}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5">
                          <p className="font-semibold mb-1">SMS Text Script</p>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{scripts.smsScript}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Generate probate-sensitive call and SMS scripts calibrated to {property.executorName} and{' '}
                        {property.county} timelines.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Log Activity &amp; Direct Mail Dispatch
                    </h3>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!logSummary.trim()) return;
                        onLogEngagement({
                          propertyId: property.id,
                          channel: logChannel,
                          summary: logSummary.trim(),
                        });
                        setLogSummary('');
                      }}
                      className="flex gap-2"
                    >
                      <select
                        aria-label="Activity channel"
                        value={logChannel}
                        onChange={(e) => setLogChannel(e.target.value as EngagementChannel)}
                        className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs font-semibold"
                      >
                        <option value="call">Phone Call</option>
                        <option value="sms">SMS Text</option>
                        <option value="email">Email</option>
                        <option value="note">Internal Note</option>
                      </select>
                      <input
                        type="text"
                        value={logSummary}
                        onChange={(e) => setLogSummary(e.target.value)}
                        placeholder={`Log call or note with ${property.executorName}...`}
                        className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs"
                      />
                      <button
                        type="submit"
                        className="h-10 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B]"
                      >
                        Log
                      </button>
                    </form>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          USPS Direct Mail (To: {property.executorMailingAddress})
                        </span>
                        {mailStatus && <span className="text-xs font-semibold text-[#0F766E] dark:text-emerald-400">{mailStatus}</span>}
                      </div>
                      <div className="flex gap-2">
                        <select
                          aria-label="Direct mail template"
                          value={mailTemplate}
                          onChange={(e) => setMailTemplate(e.target.value)}
                          className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs"
                        >
                          <option>Probate Sensitive Empathy Letter</option>
                          <option>Yellow Letter Handwritten Postcard</option>
                          <option>All-Cash As-Is Estate Proposal</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleDispatchMail}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Send Mail
                        </button>
                      </div>
                    </div>

                    {/* Send Email via User's Connected Email Account */}
                    <form onSubmit={handleSendUserEmail} className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Send Email via Connected Account ({(emailConfig?.provider ?? 'mailto').toUpperCase()})
                        </span>
                        {emailSendStatus && (
                          <span className="text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
                            {emailSendStatus}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          aria-label="Recipient email address"
                          value={emailTo}
                          onChange={(e) => setEmailTo(e.target.value)}
                          placeholder="Executor or attorney email..."
                          className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs"
                        />
                        <input
                          type="text"
                          aria-label="Email subject line"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Subject..."
                          className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs"
                        />
                      </div>
                      <textarea
                        rows={3}
                        aria-label="Email message body"
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] p-2.5 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={isSendingEmail}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B]"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isSendingEmail ? 'Sending Email...' : 'Send Email & Log to Timeline'}
                      </button>
                    </form>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Activity Timeline ({engagements.length})
                      </h4>
                      {engagements.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No outreach logged on this property yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {engagements.map((eng) => (
                            <li key={eng.id} className="rounded-lg bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs">
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                <span className="font-semibold uppercase text-slate-700 dark:text-slate-200">{eng.channel}</span>
                                <span>{formatDateShort(eng.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 text-slate-800 dark:text-slate-300">{eng.summary}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Localized LOI & Contract Generator */}
                <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Localized LOI &amp; {property.state} Contract Generator
                    </h3>
                    {docSavedNotice && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        {docSavedNotice}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="doc-type" className="block text-xs text-slate-500 dark:text-slate-400">
                        Document Type
                      </label>
                      <select
                        id="doc-type"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value as 'loi' | 'purchase_contract')}
                        className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs font-semibold"
                      >
                        <option value="loi">Letter of Intent (LOI)</option>
                        <option value="purchase_contract">{property.state} Probate Purchase Contract</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="doc-offer" className="block text-xs text-slate-500 dark:text-slate-400">
                        Offer Price ($)
                      </label>
                      <input
                        id="doc-offer"
                        type="number"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(Number(e.target.value) || 0)}
                        className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateLocalizedDocument}
                        disabled={isGeneratingDoc}
                        className="flex-1 h-10 rounded-xl bg-[#0F766E] px-3 text-xs font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap"
                      >
                        {isGeneratingDoc ? 'Generating...' : 'Generate & Save'}
                      </button>
                    </div>
                  </div>

                  <textarea
                    aria-label="Generated localized contract or LOI"
                    value={generatedDoc}
                    onChange={(e) => setGeneratedDoc(e.target.value)}
                    rows={14}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3.5 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:border-[#0F766E] focus:outline-none"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Saved Documents ({documents.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadDocument}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Document
                    </button>
                  </div>
                </div>

                <ProbateComplianceGuidancePanel property={property} />
              </div>
            )}

            {/* TAB 5: HYPER-LOCAL COUNTY RESOURCES */}
            {activeTab === 'resources' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {countyResources.county}, {countyResources.state} Officials &amp; Portals
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <p className="font-semibold">{countyResources.probateCourtClerk.officeName}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {countyResources.probateCourtClerk.address} · Est. Filing Fee:{' '}
                          {countyResources.probateCourtClerk.filingFeeEstimate}
                        </p>
                        <a
                          href={countyResources.probateCourtClerk.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-[#0F766E] dark:text-emerald-400 hover:underline"
                        >
                          Open County Probate Docket Search &rarr;
                        </a>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <p className="font-semibold">{countyResources.taxAssessor.officeName}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {countyResources.taxAssessor.millageSummary}
                        </p>
                        <a
                          href={countyResources.taxAssessor.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-[#0F766E] dark:text-emerald-400 hover:underline"
                        >
                          Open County Assessor Parcel Portal &rarr;
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {countyResources.state} Probate Process Rules &amp; Timelines
                    </h3>
                    <dl className="space-y-2.5 text-xs">
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-300">Administration Paths</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{countyResources.stateProbateRules.administrationTypes}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-300">Creditor Claim Window</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{countyResources.stateProbateRules.creditorClaimWindow}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-300">Typical Timeline</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{countyResources.stateProbateRules.typicalTimelineMonths}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-300">Small Estate Threshold</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{countyResources.stateProbateRules.smallEstateThreshold}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Fillable Local Real Estate &amp; Probate Forms
                    </h3>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {countyResources.localForms.map((form) => (
                        <li key={form.formCode} className="py-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {form.title}{' '}
                              <span className="font-mono text-xs text-slate-400">({form.formCode})</span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{form.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const content = `${form.title} (${form.formCode})\nProperty: ${property.address}, ${property.city}, ${property.state} ${property.zip}\nAPN: ${property.apn}\nCase: ${property.probateCaseNumber}\nExecutor: ${property.executorName}\n\n${form.description}`;
                              const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${form.formCode}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Swipeable Fullscreen Photo Lightbox Modal (Persists active photoIdx on exit!) */}
      {isFullscreenLightbox && mediaResolution.mode === 'photos' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen Property Photo Viewer"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
            const delta = endX - touchStartX.current;
            if (delta > 40) {
              setPhotoIdx((i) => (i - 1 + mediaResolution.photos.length) % mediaResolution.photos.length);
            } else if (delta < -40) {
              setPhotoIdx((i) => (i + 1) % mediaResolution.photos.length);
            }
            touchStartX.current = null;
          }}
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white select-none"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10">
            <div className="text-xs font-mono">
              <span className="font-bold">{photoIdx + 1} / {mediaResolution.photos.length}</span>
              <span className="text-slate-400 ml-3">{property.address}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenLightbox(false)}
              aria-label="Exit Fullscreen Viewer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
            <button
              type="button"
              aria-label="Previous Fullscreen Photo"
              onClick={() =>
                setPhotoIdx((i) => (i - 1 + mediaResolution.photos.length) % mediaResolution.photos.length)
              }
              className="absolute left-3 sm:left-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <img
              src={mediaResolution.photos[photoIdx]}
              alt={`${property.address} fullscreen view ${photoIdx + 1}`}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain rounded-lg"
            />

            <button
              type="button"
              aria-label="Next Fullscreen Photo"
              onClick={() => setPhotoIdx((i) => (i + 1) % mediaResolution.photos.length)}
              className="absolute right-3 sm:right-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 py-3 border-t border-white/10">
            {mediaResolution.photos.map((src, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Select fullscreen photo ${idx + 1}`}
                aria-pressed={photoIdx === idx}
                onClick={() => setPhotoIdx(idx)}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg border ${
                  photoIdx === idx ? 'border-emerald-400 ring-2 ring-emerald-400' : 'border-white/20 opacity-55'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
