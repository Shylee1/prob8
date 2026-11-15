import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  AdminIntegration,
  AffiliateReferral,
  BuyBox,
  CustomIntegration,
  DocumentRecord,
  EngagementRecord,
  FieldRouteStop,
  LedgerTransaction,
  NotificationPreferences,
  PaymentProcessorConfig,
  PersonRecord,
  PipelineDeal,
  PipelineStage,
  PortfolioAsset,
  PromoCode,
  PropertyPersonLink,
  PropertyRecord,
  RegisteredUserRecord,
  SubscriptionTier,
  SupportTicket,
  UserProfile,
} from '../types';

export const FOUNDER_ADMIN_EMAIL = 'busapower07@gmail.com';
const WORKSPACE_KEY_PREFIX = 'prob8_workspace_v2_';
const AUTH_REGISTRY_KEY = 'prob8_registered_users_v2';
const ACTIVE_SESSION_KEY = 'prob8_active_session_email_v2';
const PROMO_CODES_KEY = 'prob8_promo_codes_v2';
const AFFILIATES_KEY = 'prob8_affiliates_v3';
const CUSTOM_INTEGRATIONS_KEY = 'prob8_custom_integrations_v2';
const PAYMENT_SETTINGS_KEY = 'prob8_payment_settings_v2';
const LEDGER_TRANSACTIONS_KEY = 'prob8_ledger_transactions_v2';
const SUPPORT_TICKETS_KEY = 'prob8_support_tickets_v1';

export interface WorkspaceSnapshot {
  profile: UserProfile;
  buyBoxes: BuyBox[];
  pipelineDeals: PipelineDeal[];
  portfolioAssets: PortfolioAsset[];
  fieldRouteStops: FieldRouteStop[];
  people: PersonRecord[];
  propertyPeople: PropertyPersonLink[];
  engagements: EngagementRecord[];
  documents: DocumentRecord[];
}

export function isFounderAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === FOUNDER_ADMIN_EMAIL);
}

export function getSeededUsers(): RegisteredUserRecord[] {
  const founder: RegisteredUserRecord = {
    id: 'founder-admin-001',
    email: FOUNDER_ADMIN_EMAIL,
    fullName: 'Prob8 Founder Admin',
    signedUpAt: '2026-10-01T09:00:00.000Z',
    subscriptionTier: 'vip_lifetime',
    isAdmin: true,
    forcePasswordChange: true,
    status: 'active',
    passwordHashOrPlain: '123',
  };
  const testUser: RegisteredUserRecord = {
    id: 'test-user-002',
    email: 'testuser@prob8.app',
    fullName: 'Prob8 Test User (Free Tier)',
    signedUpAt: '2026-11-01T12:00:00.000Z',
    subscriptionTier: 'free',
    isAdmin: false,
    forcePasswordChange: false,
    status: 'active',
    passwordHashOrPlain: 'TestUser123!',
  };
  const defaults = [founder, testUser];
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(AUTH_REGISTRY_KEY);
    if (!raw) {
      window.localStorage.setItem(AUTH_REGISTRY_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed: RegisteredUserRecord[] = (JSON.parse(raw) as RegisteredUserRecord[]).map((u) => ({
      ...u,
      isAdmin: isFounderAdminEmail(u.email),
      subscriptionTier: isFounderAdminEmail(u.email) ? ('vip_lifetime' as const) : u.subscriptionTier,
      status: u.status ?? ('active' as const),
    }));
    const merged: RegisteredUserRecord[] = [...parsed];
    if (!merged.some((u) => isFounderAdminEmail(u.email))) {
      merged.unshift(founder);
    }
    if (!merged.some((u) => u.email.toLowerCase() === testUser.email)) {
      merged.push(testUser);
    }
    window.localStorage.setItem(AUTH_REGISTRY_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return defaults;
  }
}

export function saveRegisteredUsers(users: RegisteredUserRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_REGISTRY_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

export function getActiveSessionEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, email.toLowerCase());
    } else {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  emailDigestEnabled: true,
  buyBoxNewFilings: true,
  courthouseSyncSummary: true,
  purgedSoldAlerts: true,
  auctionOverbidCountdown: true,
  priceDropAndMao: true,
  taxDelinquencyAndPreFc: true,
  skipTraceComplete: true,
  emailRepliesAndFollowUps: true,
  courtHearingDeadlines: true,
  pipelineStageUpdates: true,
  fieldRouteNearbyLeads: false,
  affiliateAndSecurity: true,
};

export function createProfileForUser(user: RegisteredUserRecord, referredBy?: string): UserProfile {
  const founderAdmin = isFounderAdminEmail(user.email);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    subscriptionTier: founderAdmin ? 'vip_lifetime' : user.subscriptionTier,
    isAdmin: founderAdmin,
    forcePasswordChange: user.forcePasswordChange,
    aiConfig: {
      mode: 'built_in',
      provider: 'prob8_free',
      modelName: 'Prob8 Standard Templates',
      autoConfigured: true,
    },
    emailConfig: {
      provider: 'mailto',
      fromName: user.fullName,
      fromEmail: user.email,
      connected: true,
    },
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    affiliateCode: founderAdmin ? 'FOUNDER8' : `P8${user.id.slice(-5).toUpperCase()}`,
    referredBy,
    createdAt: user.signedUpAt,
  };
}

/**
 * Pipeline, People CRM, Portfolio, and Field Route MUST all start 100% empty.
 */
export function createCleanEmptyWorkspace(profile: UserProfile): WorkspaceSnapshot {
  return {
    profile,
    buyBoxes: [],
    pipelineDeals: [],
    portfolioAssets: [],
    fieldRouteStops: [],
    people: [],
    propertyPeople: [],
    engagements: [],
    documents: [],
  };
}

export function loadUserWorkspace(user: RegisteredUserRecord, referredBy?: string): WorkspaceSnapshot {
  const defaultProfile = createProfileForUser(user, referredBy);
  if (typeof window === 'undefined') return createCleanEmptyWorkspace(defaultProfile);
  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_KEY_PREFIX}${user.email.toLowerCase()}`);
    if (!raw) return createCleanEmptyWorkspace(defaultProfile);
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    const rawProfile = (parsed?.profile ?? {}) as Partial<UserProfile>;
    const founderAdmin = isFounderAdminEmail(user.email);
    const safeAiConfig =
      rawProfile && typeof rawProfile.aiConfig === 'object' && rawProfile.aiConfig !== null
        ? { ...defaultProfile.aiConfig, ...rawProfile.aiConfig }
        : defaultProfile.aiConfig;
    const safeEmailConfig =
      rawProfile && typeof rawProfile.emailConfig === 'object' && rawProfile.emailConfig !== null
        ? { ...defaultProfile.emailConfig, ...rawProfile.emailConfig }
        : defaultProfile.emailConfig;
    const safeNotifPrefs =
      rawProfile &&
      typeof rawProfile.notificationPreferences === 'object' &&
      rawProfile.notificationPreferences !== null
        ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...rawProfile.notificationPreferences }
        : { ...DEFAULT_NOTIFICATION_PREFERENCES };

    return {
      profile: {
        ...defaultProfile,
        ...rawProfile,
        trialEndsAt: rawProfile.trialEndsAt ?? undefined,
        pushToken: rawProfile.pushToken ?? undefined,
        aiConfig: safeAiConfig,
        emailConfig: safeEmailConfig,
        notificationPreferences: safeNotifPrefs,
        subscriptionTier: founderAdmin ? 'vip_lifetime' : user.subscriptionTier,
        isAdmin: founderAdmin,
        forcePasswordChange: user.forcePasswordChange,
      },
      buyBoxes: Array.isArray(parsed.buyBoxes) ? parsed.buyBoxes : [],
      pipelineDeals: Array.isArray(parsed.pipelineDeals) ? parsed.pipelineDeals : [],
      portfolioAssets: Array.isArray(parsed.portfolioAssets) ? parsed.portfolioAssets : [],
      fieldRouteStops: Array.isArray(parsed.fieldRouteStops) ? parsed.fieldRouteStops : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      propertyPeople: Array.isArray(parsed.propertyPeople) ? parsed.propertyPeople : [],
      engagements: Array.isArray(parsed.engagements) ? parsed.engagements : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return createCleanEmptyWorkspace(defaultProfile);
  }
}

export function saveUserWorkspace(email: string, snapshot: WorkspaceSnapshot): void {
  if (typeof window === 'undefined' || !email) return;
  try {
    window.localStorage.setItem(`${WORKSPACE_KEY_PREFIX}${email.toLowerCase()}`, JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
}

export function loadPromoCodes(): PromoCode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROMO_CODES_KEY);
    return raw ? (JSON.parse(raw) as PromoCode[]) : [];
  } catch {
    return [];
  }
}

export function savePromoCodes(codes: PromoCode[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROMO_CODES_KEY, JSON.stringify(codes));
}

export function loadAffiliates(): AffiliateReferral[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(AFFILIATES_KEY);
    if (raw) return JSON.parse(raw) as AffiliateReferral[];
    const initial: AffiliateReferral[] = [
      {
        id: 'aff-founder',
        partnerName: 'Prob8 Founder Partner',
        partnerEmail: 'busapower07@gmail.com',
        stateOfResidence: 'OH',
        payoutMethod: 'ACH Bank Transfer',
        payoutDestination: 'Founder Primary Account',
        taxFormType: 'W-9',
        signedFullName: 'Prob8 Founder Admin',
        signedStateAgreement: true,
        signedFtcDisclosure: true,
        signedTaxForm: true,
        signedAt: '2026-10-01T09:00:00.000Z',
        referralCode: 'FOUNDER8',
        clicks: 0,
        signups: 0,
        activeProConversions: 0,
        lifetimeConversions: 0,
        commissionRatePct: 30,
        lifetimeFlatCommissionUsd: 150,
        commissionsOwedUsd: 0,
        monthlyPayoutUsd: 0,
        totalPaidUsd: 0,
        payoutHistory: [],
      },
    ];
    window.localStorage.setItem(AFFILIATES_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return [];
  }
}

export function saveAffiliates(items: AffiliateReferral[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AFFILIATES_KEY, JSON.stringify(items));
}

export function loadCustomIntegrations(): CustomIntegration[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_INTEGRATIONS_KEY);
    return raw ? (JSON.parse(raw) as CustomIntegration[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomIntegrations(items: CustomIntegration[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOM_INTEGRATIONS_KEY, JSON.stringify(items));
}

export function loadPaymentSettings(): PaymentProcessorConfig {
  const fallback: PaymentProcessorConfig = {
    activeProcessor: 'lemonsqueezy',
    merchantAccountId: 'prob8-store-live',
    webhookSigningSecret: '',
    testMode: true,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PAYMENT_SETTINGS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<PaymentProcessorConfig>) };
  } catch {
    return fallback;
  }
}

export function savePaymentSettings(cfg: PaymentProcessorConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(cfg));
}

export function loadLedgerTransactions(): LedgerTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_TRANSACTIONS_KEY);
    return raw ? (JSON.parse(raw) as LedgerTransaction[]) : [];
  } catch {
    return [];
  }
}

export function saveLedgerTransactions(txns: LedgerTransaction[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEDGER_TRANSACTIONS_KEY, JSON.stringify(txns));
}

export function loadSupportTickets(): SupportTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUPPORT_TICKETS_KEY);
    return raw ? (JSON.parse(raw) as SupportTicket[]) : [];
  } catch {
    return [];
  }
}

export function saveSupportTickets(tickets: SupportTicket[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(tickets));
  } catch {
    // ignore storage errors
  }
}

export function loadAdminIntegrations(): AdminIntegration[] {
  return [];
}

export function saveAdminIntegrations(_items: AdminIntegration[]): void {
  // Deprecated legacy preset integrations replaced by Universal Custom Integration & Webhook Builder
}

export async function updateUserTierRemote(userId: string, tier: SubscriptionTier): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId);
}

export async function syncPropertyToSupabase(property: PropertyRecord): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await supabase.from('properties').upsert(
    {
      apn: property.apn,
      address: property.address,
      city: property.city,
      state: property.state,
      county: property.county,
      zip: property.zip,
      lat: property.lat,
      lng: property.lng,
      status: property.status,
      property_type: property.propertyType,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      lot_sqft: property.lotSqft,
      year_built: property.yearBuilt,
      probate_case_number: property.probateCaseNumber,
      filing_date: property.filingDate,
      probate_price: property.probatePrice,
      court_name: property.courtName,
      decedent_name: property.decedentName,
      executor_name: property.executorName,
      probate_attorney: property.probateAttorney,
      assessor_data: property.assessorData,
      zillow_data: property.zillowData,
      redfin_data: property.redfinData,
      avm_value: property.avmValue,
      estimated_equity: property.estimatedEquity,
      equity_pct: property.equityPct,
      mortgage_balance: property.mortgageBalance,
      tax_delinquent: property.taxDelinquent,
      is_vacant: property.isVacant,
      pre_foreclosure_overlap: property.preForeclosureOverlap,
      comps: property.comps,
      auction_data: property.auctionData ?? null,
      is_watched_auction: Boolean(property.isWatchedAuction),
    },
    { onConflict: 'state,county,apn' }
  );
}

export async function upsertPipelineDealRemote(deal: PipelineDeal): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await syncPropertyToSupabase(deal.property);
  await supabase.from('pipeline_deals').upsert(
    {
      id: deal.id,
      user_id: sessionData.session.user.id,
      property_id: deal.propertyId,
      stage: deal.stage,
      offer_amount: deal.offerAmount ?? null,
      arv_estimate: deal.arvEstimate ?? null,
      rehab_estimate: deal.rehabEstimate ?? null,
      underwriting_summary: {
        maoEstimate: deal.maoEstimate,
        projectedCashFlow: deal.projectedCashFlow,
        strategyLabel: deal.strategyLabel,
      },
      next_follow_up: deal.nextFollowUp ?? null,
      task_title: deal.taskTitle ?? null,
      notes: deal.notes,
    },
    { onConflict: 'user_id,property_id' }
  );
}

export async function updateDealStageRemote(dealId: string, stage: PipelineStage): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await supabase.from('pipeline_deals').update({ stage }).eq('id', dealId).eq('user_id', sessionData.session.user.id);
}

export async function upsertBuyBoxRemote(box: BuyBox): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await supabase.from('buy_boxes').upsert({
    id: box.id,
    user_id: sessionData.session.user.id,
    name: box.name,
    is_active: box.isActive,
    filters: box.filters,
    alert_push: box.alertPush,
  });
}

export async function upsertPersonRemote(person: PersonRecord): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await supabase.from('people').upsert({
    id: person.id,
    user_id: sessionData.session.user.id,
    full_name: person.fullName,
    role: person.role,
    phones: person.phones,
    emails: person.emails,
    mailing_address: person.mailingAddress,
    notes: person.notes,
    skip_traced: person.skipTraced,
  });
}

export async function upsertPortfolioAssetRemote(asset: PortfolioAsset): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  await supabase.from('portfolio_assets').upsert({
    id: asset.id,
    user_id: sessionData.session.user.id,
    property_id: asset.propertyId ?? null,
    address: asset.address,
    city: asset.city,
    state: asset.state,
    asset_class: asset.assetClass,
    acquisition_date: asset.acquisitionDate,
    purchase_price: asset.purchasePrice,
    current_value: asset.currentValue,
    loan_balance: asset.loanBalance,
    monthly_rent: asset.monthlyRent,
    monthly_expenses: asset.monthlyExpenses,
    occupancy_pct: asset.occupancyPct,
    notes: asset.notes,
  });
}

export async function uploadDocumentToStorage(
  userId: string,
  propertyId: string,
  title: string,
  content: string
): Promise<string> {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const storagePath = `${userId}/${propertyId}/${safeName}-${Date.now()}.txt`;
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      await supabase.storage.from('dossier-documents').upload(storagePath, blob, { upsert: true });
    }
  }
  return storagePath;
}
