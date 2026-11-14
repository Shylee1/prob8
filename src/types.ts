export type SubscriptionTier = 'free' | 'pro' | 'vip_lifetime';

export type PropertyType =
  | 'Single-Family'
  | 'Multi-Family'
  | 'Short-Term Rental'
  | 'Condo/Townhouse'
  | 'Mobile Home / Trailer Park'
  | 'Land'
  | 'Commercial';

export type PropertyStatus = 'active' | 'auction' | 'purged_sold';

export type PipelineStage =
  | 'New Probate Lead'
  | 'Skip Traced'
  | 'Contacted'
  | 'Engaged / Negotiating'
  | 'Offer Sent'
  | 'Under Contract'
  | 'Closed / Dead';

export const PIPELINE_STAGES: PipelineStage[] = [
  'New Probate Lead',
  'Skip Traced',
  'Contacted',
  'Engaged / Negotiating',
  'Offer Sent',
  'Under Contract',
  'Closed / Dead',
];

export type PersonRole =
  | 'Executor'
  | 'Administrator'
  | 'Heir'
  | 'Probate Attorney'
  | 'Cash Buyer'
  | 'Contractor'
  | 'Title Agent';

export const PERSON_ROLES: PersonRole[] = [
  'Executor',
  'Administrator',
  'Heir',
  'Probate Attorney',
  'Cash Buyer',
  'Contractor',
  'Title Agent',
];

export type EngagementChannel =
  | 'call'
  | 'sms'
  | 'email'
  | 'direct_mail'
  | 'loi'
  | 'offer'
  | 'note'
  | 'skip_trace'
  | 'auction_bid';

export interface AIConfig {
  mode: 'built_in' | 'gemini_free' | 'local_webllm' | 'ollama_local' | 'byo_api';
  provider:
    | 'prob8_free'
    | 'gemini_free'
    | 'webllm_local'
    | 'ollama_local'
    | 'openai'
    | 'anthropic'
    | 'gemini'
    | 'grok'
    | 'openrouter'
    | 'custom';
  modelName: string;
  apiKey?: string;
  customEndpoint?: string;
  autoConfigured: boolean;
  lastTestedAt?: string;
}

export interface EmailConfig {
  provider: 'mailto' | 'gmail' | 'outlook' | 'resend' | 'smtp';
  fromName: string;
  fromEmail: string;
  smtpHost?: string;
  smtpPort?: number;
  apiKeyOrPassword?: string;
  connected: boolean;
  lastTestedAt?: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailDigestEnabled: boolean;
  buyBoxNewFilings: boolean;
  courthouseSyncSummary: boolean;
  purgedSoldAlerts: boolean;
  auctionOverbidCountdown: boolean;
  priceDropAndMao: boolean;
  taxDelinquencyAndPreFc: boolean;
  skipTraceComplete: boolean;
  emailRepliesAndFollowUps: boolean;
  courtHearingDeadlines: boolean;
  pipelineStageUpdates: boolean;
  fieldRouteNearbyLeads: boolean;
  affiliateAndSecurity: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  subscriptionTier: SubscriptionTier;
  trialEndsAt?: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
  pushToken?: string;
  aiConfig: AIConfig;
  emailConfig?: EmailConfig;
  notificationPreferences?: NotificationPreferences;
  affiliateCode: string;
  referredBy?: string;
  createdAt: string;
}

export interface RegisteredUserRecord {
  id: string;
  email: string;
  fullName: string;
  signedUpAt: string;
  subscriptionTier: SubscriptionTier;
  isAdmin: boolean;
  forcePasswordChange: boolean;
  status?: 'active' | 'suspended';
  passwordHashOrPlain?: string;
}

export type PaymentProcessorId =
  | 'lemonsqueezy'
  | 'paddle'
  | 'square'
  | 'authorizenet'
  | 'paypal';

export interface PaymentProcessorConfig {
  activeProcessor: PaymentProcessorId;
  merchantAccountId: string;
  webhookSigningSecret: string;
  testMode: boolean;
  updatedAt: string;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  userId: string;
  userEmail: string;
  plan: 'Prob8 Pro ($79/mo)' | 'Prob8 Lifetime ($699)' | 'Admin Free Lifetime Grant';
  processor: PaymentProcessorId | 'admin_grant';
  promoCode?: string;
  grossUsd: number;
  feeUsd: number;
  netUsd: number;
  status: 'paid' | 'refunded' | 'trial';
  affiliateCode?: string;
}

export interface CustomIntegration {
  id: string;
  name: string;
  category: string;
  endpointUrl: string;
  triggerEvent:
    | 'all_events'
    | 'deal_closed'
    | 'pro_signup'
    | 'lifetime_purchase'
    | 'new_probate_lead'
    | 'skip_trace';
  authHeader?: string;
  fieldMappings: Array<{ sourceField: string; targetField: string }>;
  enabled: boolean;
  lastTestedAt?: string;
  lastStatus?: string;
}

export interface AdminIntegration {
  id: string;
  name: string;
  category: 'Analytics' | 'Billing' | 'Data & Skip Trace' | 'Direct Mail' | 'Infrastructure' | 'Error Monitoring';
  description: string;
  isFreeTierAvailable: boolean;
  connected: boolean;
  endpointOrKeyLabel: string;
  configuredValue: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountPct: number;
  freeTrialDays: number;
  expiresAt: string;
  usageLimit: number;
  timesUsed: number;
  isActive: boolean;
}

export interface AffiliatePayoutRecord {
  id: string;
  paidAt: string;
  amountUsd: number;
  method: 'PayPal' | 'ACH Bank Transfer';
  referenceNote: string;
}

export interface AffiliateReferral {
  id: string;
  partnerName: string;
  partnerEmail: string;
  stateOfResidence: string;
  payoutMethod: 'PayPal' | 'ACH Bank Transfer';
  payoutDestination: string;
  taxFormType: 'W-9' | 'W-8BEN';
  signedFullName: string;
  signedStateAgreement: boolean;
  signedFtcDisclosure: boolean;
  signedTaxForm: boolean;
  signedAt: string;
  referralCode: string;
  clicks: number;
  signups: number;
  activeProConversions: number;
  lifetimeConversions: number;
  commissionRatePct: number;
  lifetimeFlatCommissionUsd: number;
  commissionsOwedUsd: number;
  monthlyPayoutUsd: number;
  totalPaidUsd: number;
  payoutHistory: AffiliatePayoutRecord[];
}

export interface BuyBoxFilters {
  states: string[];
  counties: string[];
  cities: string[];
  zips: string[];
  propertyTypes: PropertyType[];
  minAssessedValue?: number;
  maxAssessedValue?: number;
  minArv?: number;
  maxArv?: number;
  minEquityPct?: number;
  minEquityDollar?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  minLotSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  filingDateFrom?: string;
  filingDateTo?: string;
  taxDelinquentOnly?: boolean;
  vacantOnly?: boolean;
  preForeclosureOverlap?: boolean;
}

export interface BuyBox {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  filters: BuyBoxFilters;
  alertPush: boolean;
  createdAt: string;
}

export interface AssessorData {
  assessedValue: number;
  marketAppraisalValue?: number;
  landValue: number;
  improvementValue: number;
  annualTaxes: number;
  taxYear: number;
  millageRate?: string;
  lastSaleDate: string;
  lastSalePrice: number;
  deedBookPage?: string;
  zoning: string;
  parcelClass: string;
  landUseCode?: string;
  subdivision?: string;
  township?: string;
  parcelMapPage?: string;
  homesteadExemption?: boolean;
  legalDescription: string;
  taxDelinquencyAmount: number;
  delinquentYears?: string;
  taxHistory: Array<{ year: number; assessed: number; taxPaid: number }>;
}

export interface ListingSourceData {
  sourceUrl: string;
  estimate: number;
  rentEstimate?: number;
  status: string;
  daysOnMarket?: number;
  pricePerSqft?: number;
  hoaFeeMonthly?: number;
  parking?: string;
  heatingCooling?: string;
  constructionType?: string;
  schoolDistrict?: string;
  walkScore?: number;
  lastSoldDate?: string;
  lastSoldPrice?: number;
  propertyDescription?: string;
  photos: string[];
}

export interface ComparableSale {
  address: string;
  soldPrice: number;
  soldDate: string;
  sqft: number;
  beds: number;
  baths: number;
  distanceMiles: number;
  pricePerSqft: number;
}

export interface AuctionData {
  auctionType: 'Sheriff Sale' | 'Probate Court Overbid' | 'Online County Auction';
  auctionPortalName: string;
  startsAt: string;
  endsAt: string;
  openingBid: number;
  currentBid: number;
  bidIncrement: number;
  depositRequired: number;
  reserveMet: boolean;
  bidCount: number;
  registrationOpen: boolean;
  isRegistered?: boolean;
  rulesSummary: string;
  lastPolledAt: string;
}

export interface PropertyRecord {
  id: string;
  apn: string;
  address: string;
  city: string;
  state: string;
  county: string;
  zip: string;
  lat: number;
  lng: number;
  status: PropertyStatus;
  propertyType: PropertyType;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;
  probateCaseNumber: string;
  filingDate: string;
  hearingDate?: string;
  probatePrice: number;
  courtName: string;
  courtDivision?: string;
  judgeName?: string;
  bondAmount?: number;
  estateInventoryValue?: number;
  decedentName: string;
  decedentDateOfDeath?: string;
  executorName: string;
  executorMailingAddress: string;
  probateAttorney: string;
  attorneyPhone?: string;
  assessorData: AssessorData;
  zillowData: ListingSourceData;
  redfinData: ListingSourceData;
  avmValue: number;
  estimatedEquity: number;
  equityPct: number;
  mortgageBalance: number;
  taxDelinquent: boolean;
  isVacant: boolean;
  preForeclosureOverlap: boolean;
  comps: ComparableSale[];
  auctionData?: AuctionData;
  isWatchedAuction?: boolean;
  lastSyncedAt: string;
}

export interface PhoneEntry {
  number: string;
  type: 'Mobile' | 'Landline' | 'Office';
  verified: boolean;
}

export interface EmailEntry {
  address: string;
  verified: boolean;
}

export interface PersonRecord {
  id: string;
  userId: string;
  fullName: string;
  role: PersonRole;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  mailingAddress: string;
  notes: string;
  skipTraced: boolean;
  createdAt: string;
}

export interface PropertyPersonLink {
  id: string;
  userId: string;
  propertyId: string;
  personId: string;
  relationshipType: PersonRole | string;
}

export interface PipelineDeal {
  id: string;
  userId: string;
  propertyId: string;
  stage: PipelineStage;
  offerAmount?: number;
  arvEstimate?: number;
  rehabEstimate?: number;
  maoEstimate?: number;
  projectedCashFlow?: number;
  strategyLabel?: string;
  nextFollowUp?: string;
  taskTitle?: string;
  notes: string;
  property: PropertyRecord;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioAsset {
  id: string;
  userId: string;
  propertyId?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  assetClass: PropertyType;
  acquisitionDate: string;
  purchasePrice: number;
  currentValue: number;
  loanBalance: number;
  monthlyRent: number;
  monthlyExpenses: number;
  occupancyPct: number;
  notes: string;
  createdAt: string;
}

export interface FieldRouteStop {
  id: string;
  property?: PropertyRecord;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  visitedAt: string;
  gpsAccuracyMeters?: number;
  conditionTag: 'Vacant / Overgrown' | 'Boarded / Distressed' | 'Probate Lead' | 'Follow-Up Needed';
  notes: string;
}

export interface EngagementRecord {
  id: string;
  userId: string;
  propertyId?: string;
  personId?: string;
  channel: EngagementChannel;
  direction: 'outbound' | 'inbound' | 'internal';
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  propertyId: string;
  docType: 'loi' | 'purchase_contract' | 'county_form' | 'probate_filing' | 'underwriting_report';
  title: string;
  storagePath: string;
  content: string;
  createdAt: string;
}

export interface CountyResource {
  state: string;
  county: string;
  probateCourtClerk: {
    officeName: string;
    phone: string;
    address: string;
    portalUrl: string;
    filingFeeEstimate: string;
  };
  taxAssessor: {
    officeName: string;
    phone: string;
    portalUrl: string;
    millageSummary: string;
  };
  stateProbateRules: {
    administrationTypes: string;
    creditorClaimWindow: string;
    typicalTimelineMonths: string;
    smallEstateThreshold: string;
    homesteadNotes: string;
  };
  countyMarketMetrics: {
    medianDaysOnMarket: number;
    medianSalePrice: number;
    yoyAppreciationPct: number;
    investorSharePct: number;
  };
  localForms: Array<{
    title: string;
    formCode: string;
    description: string;
  }>;
}
