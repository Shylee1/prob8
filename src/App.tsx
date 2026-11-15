import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Compass,
  Gavel,
  Globe2,
  List,
  Lock,
  Map as MapIcon,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { AuthAndProModal } from './components/AuthAndProModal';
import { AuthGateModal } from './components/AuthGateModal';
import { BuyBoxesView } from './components/BuyBoxesView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FieldRouteView } from './components/FieldRouteView';
import { ForcePasswordModal } from './components/ForcePasswordModal';
import { NationalSearchMap } from './components/NationalSearchMap';
import { PeopleCRMView } from './components/PeopleCRMView';
import { PipelineView } from './components/PipelineView';
import { PortfolioView } from './components/PortfolioView';
import { PropertyCard } from './components/PropertyCard';
import { TopBar, type AppView } from './components/TopBar';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  createCleanEmptyWorkspace,
  getActiveSessionEmail,
  getSeededUsers,
  isFounderAdminEmail,
  loadAffiliates,
  loadCustomIntegrations,
  loadLedgerTransactions,
  loadPaymentSettings,
  loadPromoCodes,
  loadSupportTickets,
  loadUserWorkspace,
  saveAffiliates,
  saveCustomIntegrations,
  saveLedgerTransactions,
  savePaymentSettings,
  savePromoCodes,
  saveRegisteredUsers,
  saveSupportTickets,
  saveUserWorkspace,
  setActiveSessionEmail,
  updateUserTierRemote,
  uploadDocumentToStorage,
  upsertBuyBoxRemote,
  upsertPersonRemote,
  upsertPipelineDealRemote,
  upsertPortfolioAssetRemote,
  updateDealStageRemote,
  type WorkspaceSnapshot,
} from './services/dataService';
import type {
  AffiliatePayoutRecord,
  AffiliateReferral,
  BuyBox,
  CustomIntegration,
  DocumentRecord,
  EmailEntry,
  EngagementChannel,
  EngagementRecord,
  FieldRouteStop,
  LedgerTransaction,
  PaymentProcessorConfig,
  PersonRecord,
  PersonRole,
  PhoneEntry,
  PipelineDeal,
  PipelineStage,
  PortfolioAsset,
  PromoCode,
  PropertyRecord,
  RegisteredUserRecord,
  SubscriptionTier,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
} from './types';
import { findMatchingBuyBoxes, matchesBuyBoxFilters } from './utils/buyBoxMatcher';
import { calculateMotivationScore } from './utils/motivationScore';
import {
  AFFILIATE_LIFETIME_FLAT_USD,
  AFFILIATE_PRO_RECURRING_PCT,
  PRO_MONTHLY_USD,
  calculateCheckoutTotals,
  extractReferralParams,
  getLemonSqueezyAffiliateId,
  validatePromoCode,
} from './utils/paymentAdapter';
import { applyFreemiumResultGating } from './utils/resultGating';
import { applyLocalTransactionRefund } from './utils/supportAndRefunds';

const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const AffiliatePortalView = lazy(() =>
  import('./components/AffiliatePortalView').then((m) => ({ default: m.AffiliatePortalView }))
);
const DocumentationView = lazy(() =>
  import('./components/DocumentationView').then((m) => ({ default: m.DocumentationView }))
);
const LegalDisclosuresView = lazy(() =>
  import('./components/LegalDisclosuresView').then((m) => ({ default: m.LegalDisclosuresView }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const SupportContactPanel = lazy(() =>
  import('./components/SupportContactPanel').then((m) => ({ default: m.SupportContactPanel }))
);
const PropertyDossierModal = lazy(() =>
  import('./components/PropertyDossierModal').then((m) => ({ default: m.PropertyDossierModal }))
);

const GOOGLE_MAPS_API_KEY = ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '').trim();
const HAS_GOOGLE_MAPS_KEY = Boolean(GOOGLE_MAPS_API_KEY);
const THEME_STORAGE_KEY = 'prob8_theme';

function ViewLoadingFallback() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-10">
      <div className="h-44 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6" />
    </div>
  );
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getInitialDarkTheme(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  } catch {
    return true;
  }
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [isDark, setIsDark] = useState<boolean>(getInitialDarkTheme);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  // Referral ?ref=CODE and Lemon Squeezy ?aff=ID tracking
  const referredByCode = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const { refCode, lemonSqueezyAffId } = extractReferralParams(window.location.search);
    return refCode ?? lemonSqueezyAffId ?? getLemonSqueezyAffiliateId(window);
  }, []);

  // Registered users, Promo codes, Affiliates, Payment Settings, Ledger & Custom Integrations
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserRecord[]>(() =>
    getSeededUsers()
  );
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => loadPromoCodes());
  const [affiliates, setAffiliates] = useState<AffiliateReferral[]>(() => loadAffiliates());
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>(() =>
    loadCustomIntegrations()
  );
  const [paymentSettings, setPaymentSettings] = useState<PaymentProcessorConfig>(() =>
    loadPaymentSettings()
  );
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>(() =>
    loadLedgerTransactions()
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() =>
    loadSupportTickets()
  );
  const [showPublicAffiliatePortal, setShowPublicAffiliatePortal] = useState<boolean>(false);

  // Track referral click once
  useEffect(() => {
    if (!referredByCode) return;
    setAffiliates((prev) => {
      const next = prev.map((a) =>
        a.referralCode === referredByCode ? { ...a, clicks: a.clicks + 1 } : a
      );
      saveAffiliates(next);
      return next;
    });
  }, [referredByCode]);

  // Active signed-in user (block suspended accounts automatically)
  const [activeUser, setActiveUser] = useState<RegisteredUserRecord | null>(() => {
    const email = getActiveSessionEmail();
    if (!email) return null;
    const users = getSeededUsers();
    const matched = users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    return matched && matched.status !== 'suspended' ? matched : null;
  });

  // Per-user Workspace Snapshot
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(() =>
    activeUser ? loadUserWorkspace(activeUser, referredByCode) : null
  );

  // Persist workspace changes
  useEffect(() => {
    if (activeUser && workspace) {
      saveUserWorkspace(activeUser.email, workspace);
    }
  }, [activeUser, workspace]);

  // Navigation & Modal states
  const [activeView, setActiveView] = useState<AppView>('discover');
  const [mobileDiscoverPane, setMobileDiscoverPane] = useState<'list' | 'map'>('list');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [dossierPropertyId, setDossierPropertyId] = useState<string | null>(null);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<{ query?: string; lat?: number; lng?: number; label?: string }>({});

  // National Search State
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; county?: string; state?: string }>({
    lat: 39.8283,
    lng: -98.5795,
  });
  const [activeMarketLabel, setActiveMarketLabel] = useState<string>('National US Coverage');
  const [isNationalBrowse, setIsNationalBrowse] = useState<boolean>(true);
  const [totalActiveInQuery, setTotalActiveInQuery] = useState<number>(142850);
  const [totalNationwideActive, setTotalNationwideActive] = useState<number>(142850);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<{
    lastSyncedAt: string;
    lastSlot: string;
    statesCovered: number;
    nextScheduledWindow: string;
  } | null>(null);
  const [activeBuyBoxFilterId, setActiveBuyBoxFilterId] = useState<string>('');
  const [auctionFilterOnly, setAuctionFilterOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'motivation' | 'equity' | 'newest' | 'lowest_ask'>('motivation');
  const [minEquityFilter, setMinEquityFilter] = useState<number>(0);
  const [distressFilter, setDistressFilter] = useState<'all' | 'tax_delinquent' | 'vacant' | 'pre_fc'>('all');
  const [hostedCheckoutNotice, setHostedCheckoutNotice] = useState<{ plan: string; url: string } | null>(null);

  // Listen for Google Maps Demo Key Quota Exceeded event
  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Optional Supabase Realtime listener
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const channel = supabase
      .channel('prob8-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_deals' }, () => {
        // Realtime updates handled cleanly
      })
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, []);

  // Live Auction Watched Poller (keeps live bid telemetry fresh while watching)
  useEffect(() => {
    const watchedCount = properties.filter((p) => p.isWatchedAuction && p.auctionData).length;
    if (watchedCount === 0) return;
    const timer = setInterval(() => {
      setProperties((prev) =>
        prev.map((p) =>
          p.isWatchedAuction && p.auctionData
            ? {
                ...p,
                auctionData: {
                  ...p.auctionData,
                  lastPolledAt: new Date().toISOString(),
                },
              }
            : p
        )
      );
    }, 15000);
    return () => clearInterval(timer);
  }, [properties]);

  const runSearch = useCallback(
    async (params: { query?: string; lat?: number; lng?: number; label?: string; cursor?: number; append?: boolean }) => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const resp = await fetch('/api/probate/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: params.query,
            lat: params.lat,
            lng: params.lng,
            cursor: params.cursor ?? 0,
            limit: 250,
          }),
        });
        if (!resp.ok) {
          throw new Error(`Search returned HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as {
          center: { city: string; state: string; county: string; lat: number; lng: number };
          isNationalBrowse: boolean;
          totalActiveInQuery?: number;
          totalNationwideActive?: number;
          syncSummary?: {
            lastSyncedAt: string;
            lastSlot: string;
            statesCovered: number;
            nextScheduledWindow: string;
          };
          properties: PropertyRecord[];
          nextCursor?: number | null;
        };
        setLastSearchQuery({ query: params.query, lat: params.lat, lng: params.lng, label: params.label });
        setNextCursor(data.nextCursor ?? null);
        setProperties((prev) =>
          params.append ? [...prev, ...(data.properties ?? [])] : data.properties ?? []
        );
        setSearchCenter({
          lat: data.center.lat,
          lng: data.center.lng,
          county: data.center.county,
          state: data.center.state,
        });
        setIsNationalBrowse(Boolean(data.isNationalBrowse));
        setTotalActiveInQuery(data.totalActiveInQuery ?? (data.properties?.length || 0));
        setTotalNationwideActive(data.totalNationwideActive ?? 142850);
        if (data.syncSummary) {
          setSyncSummary(data.syncSummary);
        }
        setActiveMarketLabel(
          data.isNationalBrowse
            ? 'National US Coverage'
            : params.label || `${data.center.county}, ${data.center.state}`
        );
      } catch (err) {
        setSearchError((err as Error).message || 'Unable to load probate parcels.');
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Load National Search on mount
  useEffect(() => {
    void runSearch({});
  }, [runSearch]);

  const handleAuthenticateSuccess = useCallback(
    (user: RegisteredUserRecord, updatedUsers?: RegisteredUserRecord[]) => {
      if (updatedUsers) {
        setRegisteredUsers(updatedUsers);
        saveRegisteredUsers(updatedUsers);
        if (referredByCode) {
          setAffiliates((prev) => {
            const next = prev.map((a) =>
              a.referralCode === referredByCode ? { ...a, signups: a.signups + 1 } : a
            );
            saveAffiliates(next);
            return next;
          });
        }
      }
      setActiveSessionEmail(user.email);
      setActiveUser(user);
      setWorkspace(loadUserWorkspace(user, referredByCode));
      setActiveView('discover');
    },
    [referredByCode]
  );

  const handlePasswordUpdated = useCallback(
    (newPassword: string) => {
      if (!activeUser) return;
      const updatedUser: RegisteredUserRecord = {
        ...activeUser,
        forcePasswordChange: false,
        passwordHashOrPlain: newPassword,
      };
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => (u.id === activeUser.id ? updatedUser : u));
        saveRegisteredUsers(next);
        return next;
      });
      setActiveUser(updatedUser);
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              profile: { ...prev.profile, forcePasswordChange: false },
            }
          : prev
      );
    },
    [activeUser]
  );

  const handleSignOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setActiveSessionEmail(null);
    setActiveUser(null);
    setWorkspace(null);
    setDossierPropertyId(null);
  }, []);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void runSearch({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Near Current GPS Location',
        });
      },
      () => {
        setIsSearching(false);
        setSearchError('Location access was denied. Enter any US City, County, State, or Zip above.');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }, [runSearch]);

  // Known properties across Discover + Pipeline (must precede early auth gates cleanly via safe fallback)
  const knownProperties = useMemo(() => {
    const seen = new Set<string>();
    const combined: PropertyRecord[] = [
      ...properties,
      ...(workspace?.pipelineDeals.map((d) => d.property) ?? []),
    ];
    return combined.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [properties, workspace?.pipelineDeals]);

  const savedPropertyIds = useMemo(
    () => new Set(workspace?.pipelineDeals.map((d) => d.propertyId) ?? []),
    [workspace?.pipelineDeals]
  );

  const activeBuyBoxFilter = useMemo(
    () => workspace?.buyBoxes.find((b) => b.id === activeBuyBoxFilterId) ?? null,
    [workspace?.buyBoxes, activeBuyBoxFilterId]
  );

  const filteredProperties = useMemo(() => {
    const filtered = properties.filter((p) => {
      if (auctionFilterOnly && p.status !== 'auction') return false;
      if (minEquityFilter > 0 && p.equityPct < minEquityFilter) return false;
      if (distressFilter === 'tax_delinquent' && !p.taxDelinquent) return false;
      if (distressFilter === 'vacant' && !p.isVacant) return false;
      if (distressFilter === 'pre_fc' && !p.preForeclosureOverlap) return false;
      if (activeBuyBoxFilter && !matchesBuyBoxFilters(p, activeBuyBoxFilter.filters)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'equity') return b.equityPct - a.equityPct;
      if (sortBy === 'newest') return Date.parse(b.filingDate) - Date.parse(a.filingDate);
      if (sortBy === 'lowest_ask') return a.probatePrice - b.probatePrice;
      return calculateMotivationScore(b).score - calculateMotivationScore(a).score;
    });
  }, [properties, auctionFilterOnly, minEquityFilter, distressFilter, activeBuyBoxFilter, sortBy]);

  const gatedResults = useMemo(() => {
    const tier: SubscriptionTier = workspace?.profile.subscriptionTier ?? 'free';
    return applyFreemiumResultGating(
      filteredProperties,
      tier,
      isNationalBrowse,
      totalActiveInQuery,
      totalNationwideActive
    );
  }, [
    filteredProperties,
    workspace?.profile.subscriptionTier,
    isNationalBrowse,
    totalActiveInQuery,
    totalNationwideActive,
  ]);

  const dossierProperty = useMemo(
    () => knownProperties.find((p) => p.id === dossierPropertyId) ?? null,
    [knownProperties, dossierPropertyId]
  );

  // Admin Dashboard, Affiliate & Payment callbacks
  const handleChangeUserTier = useCallback(
    (userId: string, tier: SubscriptionTier) => {
      const targetUser = registeredUsers.find((u) => u.id === userId);
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => (u.id === userId ? { ...u, subscriptionTier: tier } : u));
        saveRegisteredUsers(next);
        return next;
      });
      if (tier === 'vip_lifetime' && targetUser) {
        const grantTxn: LedgerTransaction = {
          id: createId('txn'),
          date: new Date().toISOString(),
          userId: targetUser.id,
          userEmail: targetUser.email,
          plan: 'Admin Free Lifetime Grant',
          processor: 'admin_grant',
          grossUsd: 0,
          feeUsd: 0,
          netUsd: 0,
          status: 'paid',
        };
        setLedgerTransactions((prev) => {
          const next = [grantTxn, ...prev];
          saveLedgerTransactions(next);
          return next;
        });
      }
      if (activeUser && activeUser.id === userId) {
        setActiveUser((u) => (u ? { ...u, subscriptionTier: tier } : u));
        setWorkspace((w) => (w ? { ...w, profile: { ...w.profile, subscriptionTier: tier } } : w));
      }
      void updateUserTierRemote(userId, tier);
    },
    [activeUser, registeredUsers]
  );

  const handleTriggerPasswordReset = useCallback((userId: string) => {
    setRegisteredUsers((prev) => {
      const next = prev.map((u) =>
        u.id === userId && !isFounderAdminEmail(u.email)
          ? { ...u, forcePasswordChange: true }
          : u
      );
      saveRegisteredUsers(next);
      return next;
    });
  }, []);

  const handleCreatePromoCode = useCallback((promo: Omit<PromoCode, 'id' | 'timesUsed'>) => {
    setPromoCodes((prev) => {
      const next: PromoCode[] = [{ ...promo, id: createId('promo'), timesUsed: 0 }, ...prev];
      savePromoCodes(next);
      return next;
    });
  }, []);

  const handleTogglePromoActive = useCallback((promoId: string) => {
    setPromoCodes((prev) => {
      const next = prev.map((pc) => (pc.id === promoId ? { ...pc, isActive: !pc.isActive } : pc));
      savePromoCodes(next);
      return next;
    });
  }, []);

  const handleToggleUserStatus = useCallback(
    (userId: string) => {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => {
          if (u.id !== userId || isFounderAdminEmail(u.email)) return u;
          const nextStatus: 'active' | 'suspended' = u.status === 'suspended' ? 'active' : 'suspended';
          return { ...u, status: nextStatus };
        });
        saveRegisteredUsers(next);
        return next;
      });
    },
    []
  );

  const handleRegisterAffiliate = useCallback(
    (
      payload: Omit<
        AffiliateReferral,
        | 'id'
        | 'clicks'
        | 'signups'
        | 'activeProConversions'
        | 'lifetimeConversions'
        | 'commissionRatePct'
        | 'lifetimeFlatCommissionUsd'
        | 'commissionsOwedUsd'
        | 'monthlyPayoutUsd'
        | 'totalPaidUsd'
        | 'payoutHistory'
      >
    ) => {
      const created: AffiliateReferral = {
        ...payload,
        id: createId('aff'),
        clicks: 0,
        signups: 0,
        activeProConversions: 0,
        lifetimeConversions: 0,
        commissionRatePct: AFFILIATE_PRO_RECURRING_PCT,
        lifetimeFlatCommissionUsd: AFFILIATE_LIFETIME_FLAT_USD,
        commissionsOwedUsd: 0,
        monthlyPayoutUsd: 0,
        totalPaidUsd: 0,
        payoutHistory: [],
      };
      setAffiliates((prev) => {
        const next = [created, ...prev];
        saveAffiliates(next);
        return next;
      });
    },
    []
  );

  const handleMarkAffiliatePaid = useCallback((affiliateId: string) => {
    setAffiliates((prev) => {
      const next = prev.map((aff) => {
        if (aff.id !== affiliateId || aff.commissionsOwedUsd <= 0) return aff;
        const paidAmount = Number(aff.commissionsOwedUsd.toFixed(2));
        const payoutRecord: AffiliatePayoutRecord = {
          id: createId('pay'),
          paidAt: new Date().toISOString(),
          amountUsd: paidAmount,
          method: aff.payoutMethod,
          referenceNote: `Monthly Batch (${aff.referralCode})`,
        };
        return {
          ...aff,
          commissionsOwedUsd: 0,
          monthlyPayoutUsd: 0,
          totalPaidUsd: Number((aff.totalPaidUsd + paidAmount).toFixed(2)),
          payoutHistory: [payoutRecord, ...aff.payoutHistory],
        };
      });
      saveAffiliates(next);
      return next;
    });
  }, []);

  const handleAddCustomIntegration = useCallback((item: Omit<CustomIntegration, 'id'>) => {
    const created: CustomIntegration = { ...item, id: createId('int') };
    setCustomIntegrations((prev) => {
      const next = [created, ...prev];
      saveCustomIntegrations(next);
      return next;
    });
  }, []);

  const handleToggleCustomIntegration = useCallback((id: string) => {
    setCustomIntegrations((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item));
      saveCustomIntegrations(next);
      return next;
    });
  }, []);

  const handleUpdateCustomIntegrationStatus = useCallback((id: string, statusText: string) => {
    setCustomIntegrations((prev) => {
      const next = prev.map((item) =>
        item.id === id
          ? { ...item, lastStatus: statusText, lastTestedAt: new Date().toISOString() }
          : item
      );
      saveCustomIntegrations(next);
      return next;
    });
  }, []);

  const handleDeleteCustomIntegration = useCallback((id: string) => {
    setCustomIntegrations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveCustomIntegrations(next);
      return next;
    });
  }, []);

  const handleSavePaymentSettings = useCallback((cfg: PaymentProcessorConfig) => {
    setPaymentSettings(cfg);
    savePaymentSettings(cfg);
  }, []);

  // Sync Support Tickets from server store cleanly when activeUser changes
  useEffect(() => {
    if (!activeUser) return;
    let active = true;
    const isAdminUser = isFounderAdminEmail(activeUser.email);
    const endpoint = isAdminUser
      ? '/api/admin/support/tickets'
      : `/api/support/my-tickets?email=${encodeURIComponent(activeUser.email)}`;
    const headers: Record<string, string> = isAdminUser
      ? { 'x-prob8-admin-email': activeUser.email }
      : {};

    fetch(endpoint, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tickets?: SupportTicket[] } | null) => {
        if (!active || !data?.tickets?.length) return;
        setSupportTickets((prev) => {
          const map = new Map<string, SupportTicket>();
          for (const item of prev) map.set(item.id, item);
          for (const remote of data.tickets!) map.set(remote.id, remote);
          const merged = Array.from(map.values()).sort(
            (a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)
          );
          saveSupportTickets(merged);
          return merged;
        });
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, [activeUser?.email]);

  const handleSubmitSupportTicket = useCallback(
    async (input: {
      category: SupportTicketCategory;
      subject: string;
      message: string;
      relatedTransactionId?: string;
      relatedOrderId?: string;
      requestedRefundUsd?: number;
    }): Promise<{ ok: boolean; error?: string; ticket?: SupportTicket }> => {
      if (!activeUser || !workspace) {
        return { ok: false, error: 'Sign in required.' };
      }
      const id = createId('tkt');
      try {
        const resp = await fetch('/api/support/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            userId: activeUser.id,
            userEmail: activeUser.email,
            userName: workspace.profile.fullName,
            subscriptionTier: workspace.profile.subscriptionTier,
            ...input,
          }),
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          error?: string;
          ticket?: SupportTicket;
        };
        if (!resp.ok || !data.ok || !data.ticket) {
          return { ok: false, error: data.error || 'Could not submit request.' };
        }
        setSupportTickets((prev) => {
          const next = [data.ticket!, ...prev.filter((t) => t.id !== data.ticket!.id)];
          saveSupportTickets(next);
          return next;
        });
        return { ok: true, ticket: data.ticket };
      } catch {
        const now = new Date().toISOString();
        const fallbackTicket: SupportTicket = {
          id,
          userId: activeUser.id,
          userEmail: activeUser.email,
          userName: workspace.profile.fullName,
          subscriptionTier: workspace.profile.subscriptionTier,
          category: input.category,
          subject: input.subject,
          message: input.message,
          relatedTransactionId: input.relatedTransactionId,
          relatedOrderId: input.relatedOrderId,
          requestedRefundUsd: input.requestedRefundUsd,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        };
        setSupportTickets((prev) => {
          const next = [fallbackTicket, ...prev];
          saveSupportTickets(next);
          return next;
        });
        return { ok: true, ticket: fallbackTicket };
      }
    },
    [activeUser, workspace]
  );

  const handleUpdateSupportTicket = useCallback(
    async (
      ticketId: string,
      patch: { status: SupportTicketStatus; adminResponse?: string }
    ): Promise<void> => {
      if (!activeUser || !isFounderAdminEmail(activeUser.email)) return;
      const now = new Date().toISOString();
      setSupportTickets((prev) => {
        const next = prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: patch.status,
                adminResponse:
                  patch.adminResponse !== undefined ? patch.adminResponse : t.adminResponse,
                updatedAt: now,
                resolvedAt:
                  patch.status === 'resolved' || patch.status === 'refunded'
                    ? t.resolvedAt || now
                    : t.resolvedAt,
              }
            : t
        );
        saveSupportTickets(next);
        return next;
      });
      await fetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-prob8-admin-email': activeUser.email,
        },
        body: JSON.stringify(patch),
      }).catch(() => null);
    },
    [activeUser]
  );

  const handleIssueRefund = useCallback(
    async (input: {
      transactionId?: string;
      externalOrderId?: string;
      ticketId?: string;
      userEmail?: string;
      amountUsd?: number;
      reason?: string;
      downgradeToFree?: boolean;
    }): Promise<{ ok: boolean; message: string }> => {
      if (!activeUser || !isFounderAdminEmail(activeUser.email)) {
        return { ok: false, message: 'Founder admin privileges required.' };
      }

      if (input.externalOrderId || input.ticketId) {
        const resp = await fetch('/api/admin/lemonsqueezy/refund', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-prob8-admin-email': activeUser.email,
          },
          body: JSON.stringify({
            orderId: input.externalOrderId,
            amountCents:
              input.amountUsd !== undefined && input.amountUsd > 0
                ? Math.round(input.amountUsd * 100)
                : undefined,
            ticketId: input.ticketId,
            reason: input.reason,
          }),
        });
        const data = (await resp.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          remoteMessage?: string;
        } | null;

        if (!resp.ok || !data?.ok) {
          return {
            ok: false,
            message: data?.error || `Refund failed (HTTP ${resp.status}).`,
          };
        }
      }

      if (input.transactionId || input.externalOrderId) {
        setLedgerTransactions((prev) => {
          const reconciled = applyLocalTransactionRefund(prev, {
            transactionId: input.transactionId,
            externalOrderId: input.externalOrderId,
            amountUsd: input.amountUsd,
            reason: input.reason,
          });
          saveLedgerTransactions(reconciled.transactions);
          return reconciled.transactions;
        });
      }

      if (input.downgradeToFree && input.userEmail) {
        const normalizedEmail = input.userEmail.trim().toLowerCase();
        const target = registeredUsers.find(
          (u) => u.email.toLowerCase() === normalizedEmail && !isFounderAdminEmail(u.email)
        );
        if (target) {
          handleChangeUserTier(target.id, 'free');
        }
      }

      if (input.ticketId) {
        const now = new Date().toISOString();
        setSupportTickets((prev) => {
          const next = prev.map((t) =>
            t.id === input.ticketId
              ? {
                  ...t,
                  status: 'refunded' as const,
                  adminResponse:
                    input.reason?.trim() ||
                    t.adminResponse ||
                    'Refund approved and processed from Admin Command Center.',
                  updatedAt: now,
                  resolvedAt: now,
                }
              : t
          );
          saveSupportTickets(next);
          return next;
        });
      }

      return {
        ok: true,
        message: input.externalOrderId
          ? `Refund processed cleanly for Order #${input.externalOrderId}.`
          : 'Refund approved, ledger reconciled, and customer notified in-app.',
      };
    },
    [activeUser, registeredUsers, handleChangeUserTier]
  );

  // Auth Gate (or Public Become-an-Affiliate Portal) when signed out
  if (!activeUser || !workspace) {
    if (showPublicAffiliatePortal) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-white">
          <ErrorBoundary fallbackTitle="Affiliate Portal Error">
            <Suspense fallback={<ViewLoadingFallback />}>
              <AffiliatePortalView
                affiliates={affiliates}
                onRegisterAffiliate={handleRegisterAffiliate}
                onBack={() => setShowPublicAffiliatePortal(false)}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      );
    }
    return (
      <AuthGateModal
        registeredUsers={registeredUsers}
        referredByCode={referredByCode}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenAffiliatePortal={() => setShowPublicAffiliatePortal(true)}
        onAuthenticateSuccess={handleAuthenticateSuccess}
      />
    );
  }

  // Non-dismissible Forced Password Update Modal on first Admin Sign-In
  if (workspace.profile.forcePasswordChange) {
    return (
      <ForcePasswordModal
        userEmail={workspace.profile.email}
        userId={workspace.profile.id}
        onPasswordUpdated={handlePasswordUpdated}
      />
    );
  }

  const updateWorkspace = (updater: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => {
    setWorkspace((prev) => (prev ? updater(prev) : createCleanEmptyWorkspace(workspace.profile)));
  };

  const handleUpdateProfile = (patch: Partial<WorkspaceSnapshot['profile']>) => {
    updateWorkspace((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
    if (patch.subscriptionTier) {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) =>
          u.id === activeUser.id ? { ...u, subscriptionTier: patch.subscriptionTier! } : u
        );
        saveRegisteredUsers(next);
        return next;
      });
    }
  };

  const handleCheckoutPlan = (plan: 'pro' | 'vip_lifetime', isTrial?: boolean, promoCodeInput?: string) => {
    const processor = paymentSettings.activeProcessor;
    const promoCheck = promoCodeInput?.trim()
      ? validatePromoCode(promoCodeInput, promoCodes)
      : { ok: false, discountPct: 0, freeTrialDays: 0 };
    const appliedPromo = promoCheck.ok ? promoCheck.promo : undefined;
    const discountPct = appliedPromo ? promoCheck.discountPct : 0;
    const totals = calculateCheckoutTotals({ plan, processor, discountPct, isTrial });
    const trialDays = isTrial ? Math.max(7, appliedPromo?.freeTrialDays ?? 7) : 0;
    const trialEndsAt = isTrial ? new Date(Date.now() + trialDays * 86400000).toISOString() : undefined;
    handleUpdateProfile({ subscriptionTier: plan, trialEndsAt });

    if (appliedPromo) {
      setPromoCodes((prev) => {
        const next = prev.map((pc) =>
          pc.id === appliedPromo.id ? { ...pc, timesUsed: pc.timesUsed + 1 } : pc
        );
        savePromoCodes(next);
        return next;
      });
    }

    const txn: LedgerTransaction = {
      id: createId('txn'),
      date: new Date().toISOString(),
      userId: activeUser.id,
      userEmail: activeUser.email,
      plan: plan === 'vip_lifetime' ? 'Prob8 Lifetime ($699)' : 'Prob8 Pro ($79/mo)',
      processor,
      promoCode: appliedPromo?.code,
      grossUsd: totals.grossUsd,
      feeUsd: totals.feeUsd,
      netUsd: totals.netUsd,
      status: isTrial ? 'trial' : 'paid',
      affiliateCode: workspace.profile.referredBy,
    };
    setLedgerTransactions((prev) => {
      const next = [txn, ...prev];
      saveLedgerTransactions(next);
      return next;
    });

    if (!isTrial && workspace.profile.referredBy) {
      const refCode = workspace.profile.referredBy;
      setAffiliates((prev) => {
        const next = prev.map((aff) => {
          if (aff.referralCode !== refCode) return aff;
          const commissionAdd =
            plan === 'vip_lifetime'
              ? AFFILIATE_LIFETIME_FLAT_USD
              : Number((PRO_MONTHLY_USD * (AFFILIATE_PRO_RECURRING_PCT / 100)).toFixed(2));
          return {
            ...aff,
            activeProConversions:
              plan === 'pro' ? aff.activeProConversions + 1 : aff.activeProConversions,
            lifetimeConversions:
              plan === 'vip_lifetime' ? aff.lifetimeConversions + 1 : aff.lifetimeConversions,
            commissionsOwedUsd: Number((aff.commissionsOwedUsd + commissionAdd).toFixed(2)),
            monthlyPayoutUsd: Number((aff.monthlyPayoutUsd + commissionAdd).toFixed(2)),
          };
        });
        saveAffiliates(next);
        return next;
      });
    }

    void fetch('/api/checkout/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processor,
        plan,
        userEmail: activeUser.email,
        promoCode: appliedPromo?.code,
        grossUsd: totals.grossUsd,
        isTrial,
        affiliateCode:
          workspace.profile.referredBy || getLemonSqueezyAffiliateId(window),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { checkoutUrl?: string | null } | null) => {
        if (res?.checkoutUrl) {
          setHostedCheckoutNotice({
            plan: plan === 'vip_lifetime' ? 'Prob8 Lifetime ($699)' : 'Prob8 Pro ($79/mo)',
            url: res.checkoutUrl,
          });
        }
      })
      .catch(() => null);
  };

  const handleNavigateView = (view: AppView) => {
    setShowAccountModal(false);
    setDossierPropertyId(null);
    setActiveView(view);
  };

  // Pipeline handlers
  const handleSaveToPipeline = (
    property: PropertyRecord,
    stage: PipelineStage = 'New Probate Lead',
    underwritingPatch?: {
      arvEstimate?: number;
      rehabEstimate?: number;
      maoEstimate?: number;
      projectedCashFlow?: number;
      strategyLabel?: string;
    }
  ) => {
    updateWorkspace((prev) => {
      if (prev.pipelineDeals.some((d) => d.propertyId === property.id)) return prev;
      const now = new Date().toISOString();
      const newDeal: PipelineDeal = {
        id: createId('deal'),
        userId: prev.profile.id,
        propertyId: property.id,
        stage,
        arvEstimate: underwritingPatch?.arvEstimate ?? property.avmValue,
        rehabEstimate: underwritingPatch?.rehabEstimate,
        maoEstimate: underwritingPatch?.maoEstimate,
        projectedCashFlow: underwritingPatch?.projectedCashFlow,
        strategyLabel: underwritingPatch?.strategyLabel,
        notes: '',
        property,
        createdAt: now,
        updatedAt: now,
      };
      void upsertPipelineDealRemote(newDeal);
      return { ...prev, pipelineDeals: [newDeal, ...prev.pipelineDeals] };
    });
  };

  const handleUpdateDealStage = (dealId: string, stage: PipelineStage) => {
    updateWorkspace((prev) => ({
      ...prev,
      pipelineDeals: prev.pipelineDeals.map((d) =>
        d.id === dealId ? { ...d, stage, updatedAt: new Date().toISOString() } : d
      ),
    }));
    void updateDealStageRemote(dealId, stage);
  };

  const handleRemoveDeal = (dealId: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      pipelineDeals: prev.pipelineDeals.filter((d) => d.id !== dealId),
    }));
  };

  const handlePromoteToPortfolio = (deal: PipelineDeal) => {
    const newAsset: PortfolioAsset = {
      id: createId('port'),
      userId: workspace.profile.id,
      propertyId: deal.propertyId,
      address: deal.property.address,
      city: deal.property.city,
      state: deal.property.state,
      zip: deal.property.zip,
      assetClass: deal.property.propertyType,
      acquisitionDate: new Date().toISOString().slice(0, 10),
      purchasePrice: deal.offerAmount ?? deal.maoEstimate ?? deal.property.probatePrice,
      currentValue: deal.arvEstimate ?? deal.property.avmValue,
      loanBalance: deal.property.mortgageBalance,
      monthlyRent: Math.round(deal.property.avmValue * 0.0075),
      monthlyExpenses: Math.round(deal.property.avmValue * 0.0042),
      occupancyPct: 100,
      notes: `Promoted from Pipeline (${deal.property.probateCaseNumber})`,
      createdAt: new Date().toISOString(),
    };
    updateWorkspace((prev) => ({
      ...prev,
      portfolioAssets: [newAsset, ...prev.portfolioAssets],
    }));
    void upsertPortfolioAssetRemote(newAsset);
    setActiveView('portfolio');
  };

  // Engagements
  const handleLogEngagement = (input: {
    propertyId?: string;
    personId?: string;
    channel: EngagementChannel;
    summary: string;
  }) => {
    const entry: EngagementRecord = {
      id: createId('eng'),
      userId: workspace.profile.id,
      propertyId: input.propertyId,
      personId: input.personId,
      channel: input.channel,
      direction: 'outbound',
      summary: input.summary,
      createdAt: new Date().toISOString(),
    };
    updateWorkspace((prev) => ({
      ...prev,
      engagements: [entry, ...prev.engagements],
    }));
  };

  // Bidirectional People CRM & Skip Trace
  const handleLinkPropertyPerson = (propertyId: string, personId: string, relationshipType: string) => {
    updateWorkspace((prev) => {
      if (prev.propertyPeople.some((l) => l.propertyId === propertyId && l.personId === personId)) {
        return prev;
      }
      return {
        ...prev,
        propertyPeople: [
          ...prev.propertyPeople,
          { id: createId('link'), userId: prev.profile.id, propertyId, personId, relationshipType },
        ],
      };
    });
  };

  const handleAddPerson = (input: {
    fullName: string;
    role: PersonRole;
    phone: string;
    email: string;
    mailingAddress: string;
    notes: string;
    linkedPropertyId?: string;
  }) => {
    const personId = createId('person');
    const newPerson: PersonRecord = {
      id: personId,
      userId: workspace.profile.id,
      fullName: input.fullName,
      role: input.role,
      phones: input.phone ? [{ number: input.phone, type: 'Mobile', verified: false }] : [],
      emails: input.email ? [{ address: input.email, verified: false }] : [],
      mailingAddress: input.mailingAddress,
      notes: input.notes,
      skipTraced: false,
      createdAt: new Date().toISOString(),
    };
    updateWorkspace((prev) => {
      const links = input.linkedPropertyId
        ? [
            ...prev.propertyPeople,
            {
              id: createId('link'),
              userId: prev.profile.id,
              propertyId: input.linkedPropertyId,
              personId,
              relationshipType: input.role,
            },
          ]
        : prev.propertyPeople;
      return {
        ...prev,
        people: [newPerson, ...prev.people],
        propertyPeople: links,
      };
    });
    void upsertPersonRemote(newPerson);
  };

  const handleSkipTraceProperty = async (property: PropertyRecord) => {
    const resp = await fetch('/api/skip-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: property.executorName,
        propertyId: property.id,
        mailingAddress: property.executorMailingAddress,
      }),
    });
    const data = (await resp.json()) as {
      phones: PhoneEntry[];
      emails: EmailEntry[];
      mailingAddress: string;
    };

    let targetPersonId = '';
    updateWorkspace((prev) => {
      const existing = prev.people.find(
        (p) => p.fullName.toLowerCase() === property.executorName.toLowerCase()
      );
      let nextPeople: PersonRecord[];
      if (existing) {
        targetPersonId = existing.id;
        const updated: PersonRecord = {
          ...existing,
          phones: data.phones,
          emails: data.emails,
          mailingAddress: data.mailingAddress || existing.mailingAddress,
          skipTraced: true,
        };
        void upsertPersonRemote(updated);
        nextPeople = prev.people.map((p) => (p.id === existing.id ? updated : p));
      } else {
        targetPersonId = createId('person');
        const created: PersonRecord = {
          id: targetPersonId,
          userId: prev.profile.id,
          fullName: property.executorName,
          role: 'Executor',
          phones: data.phones,
          emails: data.emails,
          mailingAddress: data.mailingAddress || property.executorMailingAddress,
          notes: `Skip-traced from ${property.probateCaseNumber} (${property.county}, ${property.state})`,
          skipTraced: true,
          createdAt: new Date().toISOString(),
        };
        void upsertPersonRemote(created);
        nextPeople = [created, ...prev.people];
      }

      const alreadyLinked = prev.propertyPeople.some(
        (l) => l.propertyId === property.id && l.personId === targetPersonId
      );
      const nextLinks = alreadyLinked
        ? prev.propertyPeople
        : [
            ...prev.propertyPeople,
            {
              id: createId('link'),
              userId: prev.profile.id,
              propertyId: property.id,
              personId: targetPersonId,
              relationshipType: 'Executor',
            },
          ];

      const eng: EngagementRecord = {
        id: createId('eng'),
        userId: prev.profile.id,
        propertyId: property.id,
        personId: targetPersonId,
        channel: 'skip_trace',
        direction: 'internal',
        summary: `Skip traced ${property.executorName}: ${data.phones[0]?.number ?? ''} · ${data.emails[0]?.address ?? ''}`,
        createdAt: new Date().toISOString(),
      };

      return {
        ...prev,
        people: nextPeople,
        propertyPeople: nextLinks,
        engagements: [eng, ...prev.engagements],
      };
    });
  };

  const handleSkipTracePerson = async (person: PersonRecord) => {
    const resp = await fetch('/api/skip-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: person.fullName,
        propertyId: person.id,
        mailingAddress: person.mailingAddress || 'US National Lookup',
      }),
    });
    const data = (await resp.json()) as {
      phones: PhoneEntry[];
      emails: EmailEntry[];
      mailingAddress: string;
    };

    updateWorkspace((prev) => {
      const nextPeople = prev.people.map((p) => {
        if (p.id !== person.id) return p;
        const updated: PersonRecord = {
          ...p,
          phones: data.phones,
          emails: data.emails,
          mailingAddress: data.mailingAddress || p.mailingAddress,
          skipTraced: true,
        };
        void upsertPersonRemote(updated);
        return updated;
      });
      const eng: EngagementRecord = {
        id: createId('eng'),
        userId: prev.profile.id,
        personId: person.id,
        channel: 'skip_trace',
        direction: 'internal',
        summary: `Skip traced CRM contact ${person.fullName}: ${data.phones[0]?.number ?? ''} · ${data.emails[0]?.address ?? ''}`,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        people: nextPeople,
        engagements: [eng, ...prev.engagements],
      };
    });
  };

  const handleSaveDocument = async (doc: {
    propertyId: string;
    docType: 'loi' | 'purchase_contract';
    title: string;
    content: string;
  }) => {
    const storagePath = await uploadDocumentToStorage(
      workspace.profile.id,
      doc.propertyId,
      doc.title,
      doc.content
    );
    const record: DocumentRecord = {
      id: createId('doc'),
      userId: workspace.profile.id,
      propertyId: doc.propertyId,
      docType: doc.docType,
      title: doc.title,
      storagePath,
      content: doc.content,
      createdAt: new Date().toISOString(),
    };
    updateWorkspace((prev) => ({
      ...prev,
      documents: [record, ...prev.documents],
    }));
  };

  // Auctions Watch & Bidding
  const handleToggleWatchAuction = (propertyId: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, isWatchedAuction: !p.isWatchedAuction } : p))
    );
  };

  const handlePlaceAuctionBid = async (propertyId: string, bidAmount: number) => {
    const resp = await fetch('/api/auctions/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        bidAmount,
        bidderEmail: workspace.profile.email,
      }),
    });
    const data = (await resp.json()) as { confirmationCode?: string };
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId && p.auctionData
          ? {
              ...p,
              isWatchedAuction: true,
              auctionData: {
                ...p.auctionData,
                currentBid: Math.max(p.auctionData.currentBid, bidAmount),
                bidCount: p.auctionData.bidCount + 1,
                reserveMet: true,
                isRegistered: true,
                lastPolledAt: new Date().toISOString(),
              },
            }
          : p
      )
    );
    handleLogEngagement({
      propertyId,
      channel: 'auction_bid',
      summary: `Submitted live in-app auction bid of $${bidAmount.toLocaleString()} (${data.confirmationCode ?? 'Confirmed'})`,
    });
  };

  // Buy-Box handlers
  const handleSaveBuyBox = (input: Omit<BuyBox, 'id' | 'userId' | 'createdAt'> & { id?: string }) => {
    updateWorkspace((prev) => {
      if (input.id) {
        return {
          ...prev,
          buyBoxes: prev.buyBoxes.map((b) => {
            if (b.id !== input.id) return b;
            const updated: BuyBox = { ...b, ...input, id: b.id };
            void upsertBuyBoxRemote(updated);
            return updated;
          }),
        };
      }
      const created: BuyBox = {
        id: createId('bb'),
        userId: prev.profile.id,
        name: input.name,
        isActive: input.isActive,
        filters: input.filters,
        alertPush: input.alertPush,
        createdAt: new Date().toISOString(),
      };
      void upsertBuyBoxRemote(created);
      return { ...prev, buyBoxes: [created, ...prev.buyBoxes] };
    });
  };

  const handleToggleBuyBoxActive = (id: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      buyBoxes: prev.buyBoxes.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, isActive: !b.isActive };
        void upsertBuyBoxRemote(updated);
        return updated;
      }),
    }));
  };

  const handleToggleBuyBoxPush = (id: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      buyBoxes: prev.buyBoxes.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, alertPush: !b.alertPush };
        void upsertBuyBoxRemote(updated);
        return updated;
      }),
    }));
  };

  const handleDeleteBuyBox = (id: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      buyBoxes: prev.buyBoxes.filter((b) => b.id !== id),
    }));
    setActiveBuyBoxFilterId((curr) => (curr === id ? '' : curr));
  };

  const handleApplyBuyBoxToSearch = (box: BuyBox) => {
    setActiveBuyBoxFilterId(box.id);
    setActiveView('discover');
    const marketQuery =
      box.filters.cities[0] ||
      box.filters.zips[0] ||
      box.filters.counties[0] ||
      box.filters.states[0] ||
      '';
    if (marketQuery) {
      void runSearch({ query: marketQuery, label: marketQuery });
    }
  };

  // Portfolio handlers
  const handleAddPortfolioAsset = (asset: Omit<PortfolioAsset, 'id' | 'userId' | 'createdAt'>) => {
    const newAsset: PortfolioAsset = {
      ...asset,
      id: createId('port'),
      userId: workspace.profile.id,
      createdAt: new Date().toISOString(),
    };
    updateWorkspace((prev) => ({
      ...prev,
      portfolioAssets: [newAsset, ...prev.portfolioAssets],
    }));
    void upsertPortfolioAssetRemote(newAsset);
  };

  const handleRemovePortfolioAsset = (id: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      portfolioAssets: prev.portfolioAssets.filter((a) => a.id !== id),
    }));
  };

  // Field Route handlers (Empty Initial State!)
  const handlePinCurrentGps = (input: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    address: string;
    city: string;
    state: string;
    conditionTag: FieldRouteStop['conditionTag'];
    notes: string;
  }) => {
    const stop: FieldRouteStop = {
      id: createId('stop'),
      address: input.address,
      city: input.city,
      state: input.state,
      lat: input.lat,
      lng: input.lng,
      visitedAt: new Date().toISOString(),
      gpsAccuracyMeters: input.accuracyMeters,
      conditionTag: input.conditionTag,
      notes: input.notes,
    };
    updateWorkspace((prev) => ({
      ...prev,
      fieldRouteStops: [stop, ...prev.fieldRouteStops],
    }));
  };

  const handleAddPropertyStop = (property: PropertyRecord, conditionTag: FieldRouteStop['conditionTag'] = 'Probate Lead') => {
    const stop: FieldRouteStop = {
      id: createId('stop'),
      property,
      address: property.address,
      city: property.city,
      state: property.state,
      lat: property.lat,
      lng: property.lng,
      visitedAt: new Date().toISOString(),
      conditionTag,
      notes: `Case ${property.probateCaseNumber} · ${property.executorName}`,
    };
    updateWorkspace((prev) => ({
      ...prev,
      fieldRouteStops: [stop, ...prev.fieldRouteStops],
    }));
  };

  const handleRemoveStop = (stopId: string) => {
    updateWorkspace((prev) => ({
      ...prev,
      fieldRouteStops: prev.fieldRouteStops.filter((s) => s.id !== stopId),
    }));
  };

  const handleReorderStops = (ordered: FieldRouteStop[]) => {
    updateWorkspace((prev) => ({
      ...prev,
      fieldRouteStops: ordered,
    }));
  };

  const handleQuickAddStopToPipeline = (stop: FieldRouteStop) => {
    if (stop.property) {
      handleSaveToPipeline(stop.property, 'New Probate Lead');
    } else {
      const syntheticProp: PropertyRecord = {
        id: createId('prop-gps'),
        apn: `GPS-${Date.now().toString().slice(-6)}`,
        address: stop.address,
        city: stop.city,
        state: stop.state,
        county: `${stop.city} County`,
        zip: '00000',
        lat: stop.lat,
        lng: stop.lng,
        status: 'active',
        propertyType: 'Single-Family',
        beds: 3,
        baths: 2,
        sqft: 1650,
        lotSqft: 6500,
        yearBuilt: 1965,
        probateCaseNumber: 'FIELD-LEAD',
        filingDate: stop.visitedAt.slice(0, 10),
        probatePrice: 225000,
        courtName: `${stop.city} Field Lead`,
        decedentName: 'Pending Owner Lookup',
        executorName: 'Pending Skip Trace',
        executorMailingAddress: `${stop.address}, ${stop.city}, ${stop.state}`,
        probateAttorney: 'Unassigned',
        assessorData: {
          assessedValue: 200000,
          landValue: 55000,
          improvementValue: 145000,
          annualTaxes: 3100,
          taxYear: 2026,
          lastSaleDate: stop.visitedAt.slice(0, 10),
          lastSalePrice: 0,
          zoning: 'R-1 Res',
          parcelClass: 'Single-Family',
          legalDescription: `GPS Pin (${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)})`,
          taxDelinquencyAmount: 0,
          taxHistory: [{ year: 2026, assessed: 200000, taxPaid: 3100 }],
        },
        zillowData: { sourceUrl: 'https://www.zillow.com', estimate: 275000, status: 'Driving Lead', photos: [] },
        redfinData: { sourceUrl: 'https://www.redfin.com', estimate: 272000, status: 'Driving Lead', photos: [] },
        avmValue: 275000,
        estimatedEquity: 275000,
        equityPct: 100,
        mortgageBalance: 0,
        taxDelinquent: false,
        isVacant: stop.conditionTag !== 'Follow-Up Needed',
        preForeclosureOverlap: false,
        comps: [],
        lastSyncedAt: new Date().toISOString(),
      };
      handleSaveToPipeline(syntheticProp, 'New Probate Lead');
    }
    setActiveView('pipeline');
  };

  const handleQuickAddStopToCrm = (stop: FieldRouteStop) => {
    handleAddPerson({
      fullName: stop.property ? stop.property.executorName : `Owner (${stop.address})`,
      role: stop.property ? 'Executor' : 'Heir',
      phone: '',
      email: '',
      mailingAddress: `${stop.address}, ${stop.city}, ${stop.state}`,
      notes: `Captured from Driving-for-Dollars pin (${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}) · ${stop.conditionTag}`,
      linkedPropertyId: stop.property?.id,
    });
    setActiveView('people');
  };

  const dossierLinkedPeople = dossierProperty
    ? workspace.propertyPeople
        .filter((l) => l.propertyId === dossierProperty.id)
        .map((l) => ({
          person: workspace.people.find((p) => p.id === l.personId),
          relationshipType: l.relationshipType,
        }))
        .filter((item): item is { person: PersonRecord; relationshipType: string } =>
          Boolean(item.person)
        )
    : [];

  const dossierDeal = dossierProperty
    ? workspace.pipelineDeals.find((d) => d.propertyId === dossierProperty.id)
    : undefined;

  const dossierEngagements = dossierProperty
    ? workspace.engagements.filter((e) => e.propertyId === dossierProperty.id)
    : [];

  const dossierDocuments = dossierProperty
    ? workspace.documents.filter((d) => d.propertyId === dossierProperty.id)
    : [];

  const liveCounterText = isNationalBrowse
    ? `${totalNationwideActive.toLocaleString()} Active Probate Parcels Nationwide`
    : `${totalActiveInQuery.toLocaleString()} Active Probate Parcels in ${activeMarketLabel}`;

  const isExclusiveAdmin =
    workspace.profile.isAdmin && isFounderAdminEmail(workspace.profile.email);

  const appShell = (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-white transition-colors">
        {/* Mandatory Google Maps Demo Key Quota Exceeded Banner */}
        {HAS_GOOGLE_MAPS_KEY && mapsQuotaExceeded && (
          <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 px-4 py-2 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 z-50">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              Google Maps API Demo Key quota reached. Some map tiles or autocomplete suggestions may be temporarily unavailable.
            </span>
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold shrink-0"
            >
              Learn more
            </a>
          </div>
        )}

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-center gap-2 z-50">
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span>Offline mode active. Saved Pipeline, CRM, Portfolio, and Field Route data remain available.</span>
          </div>
        )}

        <TopBar
          activeView={activeView}
          onNavigate={handleNavigateView}
          pipelineCount={workspace.pipelineDeals.length}
          peopleCount={workspace.people.length}
          portfolioCount={workspace.portfolioAssets.length}
          buyBoxCount={workspace.buyBoxes.filter((b) => b.isActive).length}
          openSupportCount={
            isExclusiveAdmin
              ? supportTickets.filter((t) => t.status === 'open' || t.status === 'in_review').length
              : 0
          }
          subscriptionTier={workspace.profile.subscriptionTier}
          isAdmin={isExclusiveAdmin}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onOpenBillingOrAccount={() => setShowAccountModal(true)}
          userEmail={workspace.profile.email}
        />

        {/* Hosted Lemon Squeezy Checkout Link Banner (when live checkout URL env var is set) */}
        {hostedCheckoutNotice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900 px-4 py-2 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between gap-2 z-40">
            <span className="font-medium">
              Live Lemon Squeezy hosted checkout ready for <strong>{hostedCheckoutNotice.plan}</strong>.
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={hostedCheckoutNotice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-[#0F766E] px-3 py-1 font-semibold text-white hover:bg-[#0D625B]"
              >
                Complete Hosted Payment
              </a>
              <button
                type="button"
                onClick={() => setHostedCheckoutNotice(null)}
                className="underline text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          {activeView === 'discover' && (
            <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-4 md:py-5 space-y-4">
              {/* Live Nationwide / County Dynamic Counter & Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                    <Globe2 className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                    {liveCounterText}
                  </span>
                  <span className="hidden sm:inline font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    · {syncSummary?.statesCovered ?? 51} Jurisdictions (50 States + DC) · Auto-Sync M–F 11 AM &amp; 3 PM ET
                  </span>
                  {!isNationalBrowse && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => void runSearch({})}
                        className="font-semibold text-[#0F766E] dark:text-emerald-400 hover:underline"
                      >
                        Reset to National US
                      </button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 w-full sm:w-auto">
                  <select
                    aria-label="Sort probate properties"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="motivation">Sort: Motivation Score</option>
                    <option value="equity">Sort: Highest Equity %</option>
                    <option value="newest">Sort: Newest Filing</option>
                    <option value="lowest_ask">Sort: Lowest Ask</option>
                  </select>

                  <select
                    aria-label="Filter by minimum equity"
                    value={minEquityFilter}
                    onChange={(e) => setMinEquityFilter(Number(e.target.value))}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value={0}>Equity: Any</option>
                    <option value={30}>30%+ Equity</option>
                    <option value={50}>50%+ Equity</option>
                    <option value={65}>65%+ Equity</option>
                  </select>

                  <select
                    aria-label="Filter by distress flag"
                    value={distressFilter}
                    onChange={(e) => setDistressFilter(e.target.value as typeof distressFilter)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Distress: All</option>
                    <option value="tax_delinquent">Tax Delinquent</option>
                    <option value="vacant">Vacant Estate</option>
                    <option value="pre_fc">Pre-Foreclosure Overlap</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setAuctionFilterOnly((v) => !v)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      auctionFilterOnly
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    Live Auctions
                  </button>

                  {workspace.buyBoxes.length > 0 && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <select
                        aria-label="Filter results by Buy-Box"
                        value={activeBuyBoxFilterId}
                        onChange={(e) => setActiveBuyBoxFilterId(e.target.value)}
                        className="h-9 min-w-0 max-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 truncate"
                      >
                        <option value="">All Search Results</option>
                        {workspace.buyBoxes.map((b) => (
                          <option key={b.id} value={b.id}>Buy-Box: {b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mobile List/Map View Switcher */}
                  <div className="inline-flex lg:hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-1 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setMobileDiscoverPane('list')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        mobileDiscoverPane === 'list' ? 'bg-slate-900 dark:bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <List className="h-3.5 w-3.5" />
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileDiscoverPane('map')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        mobileDiscoverPane === 'map' ? 'bg-slate-900 dark:bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      Map
                    </button>
                  </div>
                </div>
              </div>

              {/* Transparent Free Tier Missing-Out Strip vs 100% Unlocked Pro Strip */}
              <div
                aria-label="Tier Coverage Status"
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
                  gatedResults.isGated
                    ? 'border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 text-amber-950 dark:text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-200'
                }`}
              >
                {gatedResults.isGated ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        <strong>Free Tier Coverage:</strong> Showing{' '}
                        <span className="font-mono font-bold">{gatedResults.unlocked.length}</span> properties (max{' '}
                        {gatedResults.perCountyLimit}/county across {gatedResults.countiesRepresented} counties) ·{' '}
                        <strong className="font-mono text-rose-700 dark:text-rose-300">
                          Missing out on {gatedResults.lockedCount.toLocaleString()} of {gatedResults.totalAvailable.toLocaleString()} available
                        </strong>
                        .
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAccountModal(true)}
                      className="rounded-lg bg-[#0F766E] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0D625B] shrink-0"
                    >
                      Unlock 100% Map &amp; List
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400 shrink-0" />
                    <span>
                      <strong>100% Unlocked ({workspace.profile.subscriptionTier === 'vip_lifetime' ? 'VIP Lifetime' : 'Prob8 Pro'}):</strong>{' '}
                      Displaying all <span className="font-mono font-bold">{gatedResults.unlocked.length}</span> live properties on both List &amp; Map ({gatedResults.totalAvailable.toLocaleString()} indexed across {gatedResults.countiesRepresented} counties).
                    </span>
                  </div>
                )}
              </div>

              {searchError && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  {searchError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div
                  className={`${
                    mobileDiscoverPane === 'map' ? 'min-h-[540px] sm:min-h-[640px]' : ''
                  } lg:col-span-7 lg:order-2 lg:sticky lg:top-[72px] lg:h-[calc(100vh-132px)]`}
                >
                  <NationalSearchMap
                    properties={gatedResults.unlocked}
                    selectedProperty={dossierProperty}
                    center={searchCenter}
                    isNationalBrowse={isNationalBrowse}
                    onSelectProperty={(p) => setDossierPropertyId(p.id)}
                    onSearchLocation={(query) => void runSearch({ query, label: query })}
                    onUseMyLocation={handleUseMyLocation}
                    isSearching={isSearching}
                    savedPropertyIds={savedPropertyIds}
                    hideMapOnMobile={mobileDiscoverPane === 'list'}
                    totalAvailable={gatedResults.totalAvailable}
                    lockedCount={gatedResults.lockedCount}
                    isProUnlocked={!gatedResults.isGated}
                  />
                </div>

                <div
                  className={`lg:col-span-5 lg:order-1 space-y-3 ${
                    mobileDiscoverPane === 'map' ? 'hidden lg:block' : 'block'
                  }`}
                >
                  {isSearching ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className="h-36 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4"
                        />
                      ))}
                    </div>
                  ) : gatedResults.unlocked.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center">
                      <Compass className="mx-auto h-7 w-7 text-[#0F766E] dark:text-emerald-400" />
                      <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                        No Parcels Match This Filter
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Clear your active Buy-Box or Auction filter, or search another US county.
                      </p>
                      {(activeBuyBoxFilterId || auctionFilterOnly) && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBuyBoxFilterId('');
                            setAuctionFilterOnly(false);
                          }}
                          className="mt-4 h-9 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 text-xs font-semibold text-white"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {gatedResults.unlocked.map((prop) => {
                        const matched = findMatchingBuyBoxes(prop, workspace.buyBoxes).map((b) => b.name);
                        return (
                          <PropertyCard
                            key={prop.id}
                            property={prop}
                            isSelected={dossierProperty?.id === prop.id}
                            isSaved={savedPropertyIds.has(prop.id)}
                            matchedBuyBoxNames={matched}
                            onOpenDossier={(p) => setDossierPropertyId(p.id)}
                          />
                        );
                      })}

                      {nextCursor !== null && !gatedResults.isGated && (
                        <button
                          type="button"
                          disabled={isSearching}
                          onClick={() =>
                            void runSearch({
                              ...lastSearchQuery,
                              cursor: nextCursor,
                              append: true,
                            })
                          }
                          className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Load More Probate Parcels
                        </button>
                      )}

                      {/* Smart $79/mo Freemium Result Gating Banner */}
                      {gatedResults.isGated && (
                        <div
                          role="region"
                          aria-label="Prob8 Pro Lead Unlock Banner"
                          className="rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-slate-900 via-[#0F172A] to-indigo-950 p-5 text-white shadow-lg space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                              <Lock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display text-sm font-bold leading-snug">
                                Showing {gatedResults.unlocked.length} of {gatedResults.totalAvailable.toLocaleString()} Probate Properties ({gatedResults.perCountyLimit}/county cap across {gatedResults.countiesRepresented} counties)
                              </h3>
                              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                                <span className="font-mono font-bold text-[#5EEAD4]">
                                  Missing out on {gatedResults.lockedCount.toLocaleString()} High-Equity Leads in {activeMarketLabel}.
                                </span>{' '}
                                Start your 7-Day Free Trial or upgrade to Prob8 Pro ($79/mo) to unlock 100% of every US county on both Map &amp; List, AI underwriting briefs, and instant Skip Tracing.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCheckoutPlan('pro', true)}
                              className="flex-1 h-10 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap"
                            >
                              Start 7-Day Free Trial
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAccountModal(true)}
                              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/25 px-4 text-xs font-semibold text-white hover:bg-white/10 whitespace-nowrap"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-[#5EEAD4]" />
                              Prob8 Pro ($79/mo)
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'buyboxes' && (
            <BuyBoxesView
              buyBoxes={workspace.buyBoxes}
              knownProperties={knownProperties}
              onSaveBuyBox={handleSaveBuyBox}
              onToggleActive={handleToggleBuyBoxActive}
              onToggleAlertPush={handleToggleBuyBoxPush}
              onDeleteBuyBox={handleDeleteBuyBox}
              onApplyBuyBoxToSearch={handleApplyBuyBoxToSearch}
            />
          )}

          {activeView === 'pipeline' && (
            <PipelineView
              deals={workspace.pipelineDeals}
              subscriptionTier={workspace.profile.subscriptionTier}
              onSelectProperty={(p) => setDossierPropertyId(p.id)}
              onUpdateStage={handleUpdateDealStage}
              onRemoveDeal={handleRemoveDeal}
              onPromoteToPortfolio={handlePromoteToPortfolio}
              onGoToDiscover={() => setActiveView('discover')}
              onOpenUpgradeModal={() => setShowAccountModal(true)}
            />
          )}

          {activeView === 'people' && (
            <PeopleCRMView
              key={focusedPersonId ?? 'crm-default'}
              people={workspace.people}
              propertyPeople={workspace.propertyPeople}
              knownProperties={knownProperties}
              engagements={workspace.engagements}
              subscriptionTier={workspace.profile.subscriptionTier}
              onAddPerson={handleAddPerson}
              onLinkProperty={handleLinkPropertyPerson}
              onSkipTracePerson={handleSkipTracePerson}
              onOpenPropertyDossier={(p) => setDossierPropertyId(p.id)}
              onOpenUpgradeModal={() => setShowAccountModal(true)}
              initialSelectedPersonId={focusedPersonId}
            />
          )}

          {activeView === 'portfolio' && (
            <PortfolioView
              assets={workspace.portfolioAssets}
              onAddAsset={handleAddPortfolioAsset}
              onRemoveAsset={handleRemovePortfolioAsset}
            />
          )}

          {activeView === 'route' && (
            <FieldRouteView
              stops={workspace.fieldRouteStops}
              pipelineDeals={workspace.pipelineDeals}
              searchedProperties={properties}
              onPinCurrentGps={handlePinCurrentGps}
              onAddPropertyStop={handleAddPropertyStop}
              onRemoveStop={handleRemoveStop}
              onReorderStops={handleReorderStops}
              onQuickAddToPipeline={handleQuickAddStopToPipeline}
              onQuickAddToCrm={handleQuickAddStopToCrm}
              onOpenDossier={(p) => setDossierPropertyId(p.id)}
              onGoToDiscover={() => setActiveView('discover')}
            />
          )}

          {activeView === 'docs' && (
            <ErrorBoundary fallbackTitle="Documentation View Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <DocumentationView onOpenSupport={() => handleNavigateView('support')} />
              </Suspense>
            </ErrorBoundary>
          )}

          {activeView === 'support' && (
            <ErrorBoundary fallbackTitle="Support Desk Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <SupportContactPanel
                  userProfile={workspace.profile}
                  userTransactions={ledgerTransactions.filter(
                    (t) => t.userEmail.toLowerCase() === workspace.profile.email.toLowerCase()
                  )}
                  tickets={supportTickets.filter(
                    (t) => t.userEmail.toLowerCase() === workspace.profile.email.toLowerCase()
                  )}
                  onSubmitTicket={handleSubmitSupportTicket}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {activeView === 'affiliate' && (
            <ErrorBoundary fallbackTitle="Affiliate Portal Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <AffiliatePortalView
                  currentUserEmail={workspace.profile.email}
                  currentUserName={workspace.profile.fullName}
                  affiliates={affiliates}
                  onRegisterAffiliate={handleRegisterAffiliate}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {activeView === 'settings' && (
            <ErrorBoundary fallbackTitle="Settings View Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <SettingsView
                  profile={workspace.profile}
                  isDark={isDark}
                  activeProcessor={paymentSettings.activeProcessor}
                  promoCodes={promoCodes}
                  onToggleTheme={() => setIsDark((d) => !d)}
                  onUpdateProfile={handleUpdateProfile}
                  onCheckoutPlan={handleCheckoutPlan}
                  onOpenAffiliatePortal={() => handleNavigateView('affiliate')}
                  onOpenSupport={() => handleNavigateView('support')}
                  onSignOut={() => void handleSignOut()}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {activeView === 'admin' && isExclusiveAdmin && (
            <ErrorBoundary fallbackTitle="Admin Command Center Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <AdminDashboardView
                  adminEmail={workspace.profile.email}
                  users={registeredUsers}
                  promoCodes={promoCodes}
                  affiliates={affiliates}
                  customIntegrations={customIntegrations}
                  paymentSettings={paymentSettings}
                  ledgerTransactions={ledgerTransactions}
                  supportTickets={supportTickets}
                  onChangeUserTier={handleChangeUserTier}
                  onToggleUserStatus={handleToggleUserStatus}
                  onTriggerPasswordReset={handleTriggerPasswordReset}
                  onCreatePromoCode={handleCreatePromoCode}
                  onTogglePromoActive={handleTogglePromoActive}
                  onMarkAffiliatePaid={handleMarkAffiliatePaid}
                  onAddCustomIntegration={handleAddCustomIntegration}
                  onToggleCustomIntegration={handleToggleCustomIntegration}
                  onUpdateCustomIntegrationStatus={handleUpdateCustomIntegrationStatus}
                  onDeleteCustomIntegration={handleDeleteCustomIntegration}
                  onSavePaymentSettings={handleSavePaymentSettings}
                  onUpdateSupportTicket={handleUpdateSupportTicket}
                  onIssueRefund={handleIssueRefund}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {activeView === 'legal' && (
            <ErrorBoundary fallbackTitle="Legal Disclosures Error">
              <Suspense fallback={<ViewLoadingFallback />}>
                <LegalDisclosuresView />
              </Suspense>
            </ErrorBoundary>
          )}
        </main>

        {/* Full-Screen Responsive Property Dossier Modal */}
        {dossierProperty && (
          <ErrorBoundary fallbackTitle="Property Dossier Error">
            <Suspense fallback={null}>
              <PropertyDossierModal
                property={dossierProperty}
                subscriptionTier={workspace.profile.subscriptionTier}
                userEmail={workspace.profile.email}
                emailConfig={workspace.profile.emailConfig}
                existingDeal={dossierDeal}
                linkedPeople={dossierLinkedPeople}
                allPeople={workspace.people}
                engagements={dossierEngagements}
                documents={dossierDocuments}
                onClose={() => setDossierPropertyId(null)}
                onSaveToPipeline={handleSaveToPipeline}
                onUpdateDealStage={handleUpdateDealStage}
                onLogEngagement={handleLogEngagement}
                onSkipTraceProperty={handleSkipTraceProperty}
                onLinkExistingPerson={handleLinkPropertyPerson}
                onSaveDocument={handleSaveDocument}
                onToggleWatchAuction={handleToggleWatchAuction}
                onPlaceAuctionBid={handlePlaceAuctionBid}
                onOpenPersonInCrm={(personId) => {
                  setDossierPropertyId(null);
                  setFocusedPersonId(personId);
                  setActiveView('people');
                }}
                onOpenUpgradeModal={() => setShowAccountModal(true)}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Membership & Upgrade Modal */}
        {showAccountModal && (
          <AuthAndProModal
            profile={workspace.profile}
            activeProcessor={paymentSettings.activeProcessor}
            promoCodes={promoCodes}
            onUpdateProfile={handleUpdateProfile}
            onCheckoutPlan={handleCheckoutPlan}
            onOpenSupport={() => handleNavigateView('support')}
            onSignOut={() => void handleSignOut()}
            onClose={() => setShowAccountModal(false)}
          />
        )}
      </div>
  );

  return HAS_GOOGLE_MAPS_KEY ? (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      language="en"
      region="US"
      libraries={['places', 'marker', 'streetView', 'geocoding']}
    >
      {appShell}
    </APIProvider>
  ) : (
    appShell
  );
}
