import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  FileCheck2,
  Gift,
  Inbox,
  KeyRound,
  Link2,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AffiliateReferral,
  CustomIntegration,
  LedgerTransaction,
  LemonSqueezyOverviewResponse,
  PaymentProcessorConfig,
  PaymentProcessorId,
  PromoCode,
  RegisteredUserRecord,
  SubscriptionTier,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
} from '../types';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import {
  PAYMENT_PROCESSORS,
  buildStateLocalizedAffiliateAgreement,
  exportLedgerToAccountingJson,
  exportLedgerToCsv,
  formatTierLabel,
  isEligibleForAffiliatePayout,
} from '../utils/paymentAdapter';
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  filterAndSortSupportTickets,
  findRefundableTransactionForTicket,
} from '../utils/supportAndRefunds';

interface EnvVarStatus {
  name: string;
  configured: boolean;
  isFree: boolean;
  autoConfiguredOnVercel: boolean;
  purpose: string;
}

type AdminTab = 'overview' | 'financials' | 'users' | 'affiliates' | 'promos_integrations' | 'inbox';

interface AdminDashboardViewProps {
  adminEmail: string;
  users: RegisteredUserRecord[];
  promoCodes: PromoCode[];
  affiliates: AffiliateReferral[];
  customIntegrations: CustomIntegration[];
  paymentSettings: PaymentProcessorConfig;
  ledgerTransactions: LedgerTransaction[];
  supportTickets: SupportTicket[];
  onChangeUserTier: (userId: string, tier: SubscriptionTier) => void;
  onToggleUserStatus: (userId: string) => void;
  onTriggerPasswordReset: (userId: string) => void;
  onCreatePromoCode: (promo: Omit<PromoCode, 'id' | 'timesUsed'>) => void;
  onTogglePromoActive: (promoId: string) => void;
  onMarkAffiliatePaid: (affiliateId: string) => void;
  onAddCustomIntegration: (integration: Omit<CustomIntegration, 'id'>) => void;
  onToggleCustomIntegration: (id: string) => void;
  onUpdateCustomIntegrationStatus: (id: string, statusText: string) => void;
  onDeleteCustomIntegration: (id: string) => void;
  onSavePaymentSettings: (cfg: PaymentProcessorConfig) => void;
  onUpdateSupportTicket: (
    ticketId: string,
    patch: { status: SupportTicketStatus; adminResponse?: string }
  ) => Promise<void>;
  onIssueRefund: (input: {
    transactionId?: string;
    externalOrderId?: string;
    ticketId?: string;
    userEmail?: string;
    amountUsd?: number;
    reason?: string;
    downgradeToFree?: boolean;
  }) => Promise<{ ok: boolean; message: string }>;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminEmail,
  users,
  promoCodes,
  affiliates,
  customIntegrations,
  paymentSettings,
  ledgerTransactions,
  supportTickets,
  onChangeUserTier,
  onToggleUserStatus,
  onTriggerPasswordReset,
  onCreatePromoCode,
  onTogglePromoActive,
  onMarkAffiliatePaid,
  onAddCustomIntegration,
  onToggleCustomIntegration,
  onUpdateCustomIntegrationStatus,
  onDeleteCustomIntegration,
  onSavePaymentSettings,
  onUpdateSupportTicket,
  onIssueRefund,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro' | 'vip_lifetime' | 'suspended'>('all');
  const [adminToast, setAdminToast] = useState<string | null>(null);

  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(
    () => affiliates[0]?.id ?? null
  );

  // Payment Settings draft
  const [procDraft, setProcDraft] = useState<PaymentProcessorConfig>(paymentSettings);

  // Promo form state
  const [newPromoCode, setNewPromoCode] = useState('');
  const [discountPct, setDiscountPct] = useState(50);
  const [trialDays, setTrialDays] = useState(14);
  const [usageLimit, setUsageLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState('2027-12-31');

  // Universal Custom Integration Builder form
  const [intName, setIntName] = useState('');
  const [intCategory, setIntCategory] = useState('Accounting / QuickBooks / Xero');
  const [intUrl, setIntUrl] = useState('');
  const [intEvent, setIntEvent] = useState<CustomIntegration['triggerEvent']>('all_events');
  const [intAuthHeader, setIntAuthHeader] = useState('');
  const [intMapSource, setIntMapSource] = useState('userEmail');
  const [intMapTarget, setIntMapTarget] = useState('customer_email');
  const [testingIntId, setTestingIntId] = useState<string | null>(null);

  const [copiedTestCreds, setCopiedTestCreds] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [envPlatform, setEnvPlatform] = useState<string>('Checking runtime...');
  const [envVars, setEnvVars] = useState<EnvVarStatus[]>([]);
  const [isRefreshingEnv, setIsRefreshingEnv] = useState(false);

  // Support Inbox & Refund Desk State
  const [ticketCatFilter, setTicketCatFilter] = useState<'all' | SupportTicketCategory>('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    () => supportTickets[0]?.id ?? null
  );
  const [replyDraft, setReplyDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<SupportTicketStatus>('in_review');
  const [overrideOrderId, setOverrideOrderId] = useState('');
  const [downgradeOnRefund, setDowngradeOnRefund] = useState(true);
  const [isProcessingTicket, setIsProcessingTicket] = useState(false);

  // Lemon Squeezy Live Overview State
  const [lsOverview, setLsOverview] = useState<LemonSqueezyOverviewResponse | null>(null);
  const [isLoadingLs, setIsLoadingLs] = useState(false);
  const [confirmingRefundKey, setConfirmingRefundKey] = useState<string | null>(null);
  const [refundingKey, setRefundingKey] = useState<string | null>(null);

  const notify = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(null), 4500);
  };

  const loadEnvStatus = async () => {
    setIsRefreshingEnv(true);
    try {
      const envResp = await fetch('/api/system/env-status');
      if (envResp.ok) {
        const data = (await envResp.json()) as { platform: string; vars: EnvVarStatus[] };
        setEnvPlatform(data.platform);
        setEnvVars(data.vars);
      }
    } finally {
      setIsRefreshingEnv(false);
    }
  };

  const loadLemonSqueezyOverview = async () => {
    setIsLoadingLs(true);
    try {
      const resp = await fetch('/api/admin/lemonsqueezy/overview', {
        headers: { 'x-prob8-admin-email': adminEmail },
      });
      if (resp.ok) {
        const data = (await resp.json()) as LemonSqueezyOverviewResponse;
        setLsOverview(data);
      }
    } catch {
      // Leave null if offline
    } finally {
      setIsLoadingLs(false);
    }
  };

  useEffect(() => {
    void loadEnvStatus();
    void loadLemonSqueezyOverview();
  }, [adminEmail]);

  const kpis = useMemo(() => {
    const activePro = users.filter((u) => u.subscriptionTier === 'pro' && u.status !== 'suspended').length;
    const freeCount = users.filter((u) => u.subscriptionTier === 'free' && u.status !== 'suspended').length;
    const lifetimeCount = users.filter((u) => u.subscriptionTier === 'vip_lifetime').length;
    const paidTxns = ledgerTransactions.filter((t) => t.status === 'paid');
    const refundedTxns = ledgerTransactions.filter((t) => t.status === 'refunded');
    const ledgerGross = paidTxns.reduce((s, t) => s + t.grossUsd, 0);
    const ledgerFees = paidTxns.reduce((s, t) => s + t.feeUsd, 0);
    const lifetimeRev = paidTxns
      .filter((t) => t.plan === 'Prob8 Lifetime ($699)')
      .reduce((s, t) => s + t.grossUsd, 0);
    const mrr = activePro * 79;
    const grossRevenue = Math.max(mrr, ledgerGross);
    const netProfit = Math.max(0, grossRevenue - ledgerFees);
    const commissionsOwed = affiliates.reduce((s, a) => s + (a.commissionsOwedUsd ?? 0), 0);
    const dailySearches = 380 + users.length * 14 + ledgerTransactions.length * 6;
    const refundRate =
      ledgerTransactions.length > 0
        ? Number(((refundedTxns.length / ledgerTransactions.length) * 100).toFixed(1))
        : 0;
    const promoRedemptions = promoCodes.reduce((s, p) => s + p.timesUsed, 0);
    return {
      grossRevenue,
      mrr,
      lifetimeRev,
      netProfit,
      totalUsers: users.length,
      activePro,
      freeCount,
      lifetimeCount,
      activeAffiliates: affiliates.length,
      commissionsOwed,
      dailySearches,
      refundRate,
      ledgerFees,
      promoRedemptions,
    };
  }, [users, affiliates, ledgerTransactions, promoCodes]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (tierFilter === 'suspended' && u.status !== 'suspended') return false;
      if (tierFilter !== 'all' && tierFilter !== 'suspended' && u.subscriptionTier !== tierFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q);
    });
  }, [users, userSearch, tierFilter]);

  const selectedAffiliate = useMemo(
    () => affiliates.find((a) => a.id === selectedAffiliateId) ?? affiliates[0] ?? null,
    [affiliates, selectedAffiliateId]
  );

  const handleRunManualSync = async () => {
    setIsSyncing(true);
    try {
      const resp = await fetch('/api/county-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: 'Admin Manual Sync' }),
      });
      const data = (await resp.json()) as {
        countiesScanned: number;
        newFilingsIngested: number;
        existingPropertiesUpdated?: number;
        soldPropertiesPurged: number;
        auctionsUpdated: number;
        scheduledSlots?: string[];
      };
      setSyncResult(
        `Scanned ${data.countiesScanned.toLocaleString()} counties · +${data.newFilingsIngested} new filings · ${data.existingPropertiesUpdated ?? 0} existing updated · -${data.soldPropertiesPurged} unavailable purged · ${data.auctionsUpdated} live auctions refreshed (${(data.scheduledSlots ?? ['11:00 AM ET', '3:00 PM ET']).join(' & ')}).`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) return;
    onCreatePromoCode({
      code: newPromoCode.trim().toUpperCase(),
      discountPct,
      freeTrialDays: trialDays,
      expiresAt,
      usageLimit,
      isActive: true,
    });
    notify(`Created promo code ${newPromoCode.trim().toUpperCase()}.`);
    setNewPromoCode('');
  };

  const handleCreateCustomIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intName.trim() || !intUrl.trim()) return;
    onAddCustomIntegration({
      name: intName.trim(),
      category: intCategory.trim() || 'Custom Webhook',
      endpointUrl: intUrl.trim(),
      triggerEvent: intEvent,
      authHeader: intAuthHeader.trim() || undefined,
      fieldMappings: intMapSource.trim()
        ? [{ sourceField: intMapSource.trim(), targetField: intMapTarget.trim() || intMapSource.trim() }]
        : [],
      enabled: true,
      lastStatus: 'Ready (Not yet tested)',
    });
    notify(`Added custom integration "${intName.trim()}".`);
    setIntName('');
    setIntUrl('');
    setIntAuthHeader('');
  };

  const handleTestCustomIntegration = async (item: CustomIntegration) => {
    setTestingIntId(item.id);
    try {
      const resp = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: item.endpointUrl,
          authHeader: item.authHeader,
          payload: {
            source: 'prob8-admin',
            integration: item.name,
            triggerEvent: item.triggerEvent,
            fieldMappings: item.fieldMappings,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      const data = (await resp.json()) as { message: string };
      onUpdateCustomIntegrationStatus(item.id, data.message);
      notify(data.message);
    } finally {
      setTestingIntId(null);
    }
  };

  const openTicketsCount = useMemo(
    () => supportTickets.filter((t) => t.status === 'open' || t.status === 'in_review').length,
    [supportTickets]
  );

  const filteredTickets = useMemo(
    () =>
      filterAndSortSupportTickets(supportTickets, {
        category: ticketCatFilter,
        status: ticketStatusFilter,
        search: ticketSearch,
      }),
    [supportTickets, ticketCatFilter, ticketStatusFilter, ticketSearch]
  );

  const selectedTicket = useMemo(
    () => filteredTickets.find((t) => t.id === selectedTicketId) ?? filteredTickets[0] ?? null,
    [filteredTickets, selectedTicketId]
  );

  useEffect(() => {
    if (selectedTicket) {
      setReplyDraft(selectedTicket.adminResponse || '');
      setStatusDraft(selectedTicket.status === 'open' ? 'in_review' : selectedTicket.status);
      setOverrideOrderId(selectedTicket.relatedOrderId || '');
    }
  }, [selectedTicket?.id]);

  const handleSaveTicketUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setIsProcessingTicket(true);
    try {
      await onUpdateSupportTicket(selectedTicket.id, {
        status: statusDraft,
        adminResponse: replyDraft.trim(),
      });
      notify(`Updated ticket from ${selectedTicket.userEmail} (${SUPPORT_STATUS_LABELS[statusDraft]}).`);
    } finally {
      setIsProcessingTicket(false);
    }
  };

  const handleCancelLsSubscription = async (subId: string) => {
    setRefundingKey(`sub-${subId}`);
    try {
      const resp = await fetch(`/api/admin/lemonsqueezy/subscriptions/${encodeURIComponent(subId)}/cancel`, {
        method: 'POST',
        headers: { 'x-prob8-admin-email': adminEmail },
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string; message?: string };
      if (!resp.ok || !data.ok) {
        notify(data.error || 'Could not cancel Lemon Squeezy subscription.');
        return;
      }
      notify(data.message || `Cancelled Lemon Squeezy subscription #${subId}.`);
      await loadLemonSqueezyOverview();
    } finally {
      setRefundingKey(null);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: '1. Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'financials', label: '2. Financial & Accounting', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'users', label: '3. User Management', icon: <Users className="h-4 w-4" /> },
    { id: 'affiliates', label: '4. Affiliates & Dossiers', icon: <Award className="h-4 w-4" /> },
    { id: 'promos_integrations', label: '5. Promos & Integrations', icon: <Plug className="h-4 w-4" /> },
    {
      id: 'inbox',
      label: openTicketsCount > 0 ? `6. Inbox & Refunds (${openTicketsCount})` : '6. Inbox & Refunds',
      icon: <Inbox className="h-4 w-4" />,
    },
  ];

  const chartBars = [
    { label: 'Pro MRR', value: kpis.mrr, color: '#0F766E' },
    { label: 'Lifetime', value: kpis.lifetimeRev, color: '#4F46E5' },
    { label: 'Net Profit', value: kpis.netProfit, color: '#10B981' },
    { label: 'Proc. Fees', value: kpis.ledgerFees, color: '#F59E0B' },
    { label: 'Aff. Owed', value: kpis.commissionsOwed, color: '#EC4899' },
  ];
  const maxChartVal = Math.max(100, ...chartBars.map((b) => b.value));

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Prob8 Executive Admin Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Locked to Founder <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">busapower07@gmail.com</span> · Processor:{' '}
            <span className="font-semibold text-[#0F766E] dark:text-emerald-400">
              {PAYMENT_PROCESSORS.find((p) => p.id === paymentSettings.activeProcessor)?.name}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRunManualSync()}
          disabled={isSyncing}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B]"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing 3,143 Counties...' : 'Run County Sync & Purge Now'}
        </button>
      </div>

      {/* 5-Page Tab Navigation */}
      <nav aria-label="Admin Command Center Pages" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {(syncResult || adminToast) && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {adminToast || syncResult}
        </div>
      )}

      {/* PAGE 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <section aria-label="Executive KPIs" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Gross Revenue', value: formatCurrency(kpis.grossRevenue), sub: 'All paid checkouts' },
              { label: 'Monthly MRR', value: formatCurrency(kpis.mrr), sub: `ARR ${formatCurrency(kpis.mrr * 12)}` },
              { label: 'Lifetime Revenue', value: formatCurrency(kpis.lifetimeRev), sub: '$699 one-time licenses' },
              { label: 'Net Profit', value: formatCurrency(kpis.netProfit), sub: 'After processor fees' },
              { label: 'Total Users', value: kpis.totalUsers.toLocaleString(), sub: `${kpis.freeCount} Free tier` },
              { label: 'Active Pro ($79/mo)', value: kpis.activePro.toLocaleString(), sub: 'Recurring subscribers' },
              { label: 'Lifetime Members', value: kpis.lifetimeCount.toLocaleString(), sub: 'Paid + Admin granted' },
              { label: 'Active Affiliates', value: kpis.activeAffiliates.toLocaleString(), sub: '30% Pro / $150 Life' },
              { label: 'Commissions Owed', value: formatCurrency(kpis.commissionsOwed), sub: '$50 min monthly batch' },
              { label: 'Daily Searches', value: kpis.dailySearches.toLocaleString(), sub: '50 States + DC queries' },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-1"
              >
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {card.value}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{card.sub}</p>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Fintech SVG Revenue Chart */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Live Revenue, Profit &amp; Commission Distribution
                </h2>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Real-time Ledger Sync
                </span>
              </div>
              <svg viewBox="0 0 540 190" className="w-full h-48 overflow-visible" role="img" aria-label="Revenue breakdown chart">
                {chartBars.map((bar, idx) => {
                  const barHeight = Math.max(10, Math.round((bar.value / maxChartVal) * 120));
                  const x = 24 + idx * 102;
                  const y = 148 - barHeight;
                  return (
                    <g key={bar.label}>
                      <rect
                        x={x}
                        y={y}
                        width={62}
                        height={barHeight}
                        rx={8}
                        fill={bar.color}
                        opacity={0.9}
                      />
                      <text
                        x={x + 31}
                        y={y - 6}
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-200 text-[10px] font-mono font-bold"
                      >
                        {formatCurrency(bar.value)}
                      </text>
                      <text
                        x={x + 31}
                        y={170}
                        textAnchor="middle"
                        className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold"
                      >
                        {bar.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </section>

            {/* Tier Distribution & QA Test Credentials */}
            <section className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  Account Tier Mix
                </h2>
                {[
                  { label: 'Free Tier ($0/mo)', count: kpis.freeCount, color: 'bg-slate-400' },
                  { label: 'Prob8 Pro ($79/mo)', count: kpis.activePro, color: 'bg-[#0F766E]' },
                  { label: 'Prob8 Lifetime ($699)', count: kpis.lifetimeCount, color: 'bg-indigo-600' },
                ].map((row) => {
                  const pct = kpis.totalUsers > 0 ? Math.round((row.count / kpis.totalUsers) * 100) : 0;
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{row.label}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 dark:bg-[#111827] p-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white">
                    QA Free Tier Test User
                  </h3>
                  <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    testuser@prob8.app · TestUser123!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText('testuser@prob8.app / TestUser123!');
                    setCopiedTestCreds(true);
                    setTimeout(() => setCopiedTestCreds(false), 2500);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  {copiedTestCreds ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedTestCreds ? 'Copied' : 'Copy'}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* PAGE 2: FINANCIAL MONITORING & ACCOUNTING */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Payment Processor Configuration */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Payment Processor Configuration (Merchant-of-Record &amp; Direct Gateways)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switch live checkout between Merchant-of-Record (Lemon Squeezy, Paddle) and Direct Merchant Processors (Square, Authorize.Net, PayPal Commerce).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {PAYMENT_PROCESSORS.map((proc) => {
                const selected = procDraft.activeProcessor === proc.id;
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setProcDraft((d) => ({ ...d, activeProcessor: proc.id as PaymentProcessorId }))}
                    className={`rounded-xl border p-3.5 text-left space-y-1 transition-colors ${
                      selected
                        ? 'border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#090D16]'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{proc.name}</p>
                    <p className="font-mono text-[10px] font-semibold text-[#0F766E] dark:text-emerald-400">
                      {proc.typeLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {(proc.feePct * 100).toFixed(2)}% + ${proc.feeFixedUsd.toFixed(2)}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
              <div>
                <label htmlFor="proc-merchant-id" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Merchant / Store ID
                </label>
                <input
                  id="proc-merchant-id"
                  type="text"
                  value={procDraft.merchantAccountId}
                  onChange={(e) => setProcDraft((d) => ({ ...d, merchantAccountId: e.target.value }))}
                  placeholder="e.g. prob8-store-live"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono"
                />
              </div>

              <div>
                <label htmlFor="proc-secret" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Webhook Signing Secret (Optional)
                </label>
                <input
                  id="proc-secret"
                  type="password"
                  value={procDraft.webhookSigningSecret}
                  onChange={(e) => setProcDraft((d) => ({ ...d, webhookSigningSecret: e.target.value }))}
                  placeholder="whsec_..."
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 h-10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={procDraft.testMode}
                    onChange={(e) => setProcDraft((d) => ({ ...d, testMode: e.target.checked }))}
                    className="h-4 w-4 accent-[#0F766E]"
                  />
                  <span className="font-semibold">Sandbox Test Mode</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onSavePaymentSettings({ ...procDraft, updatedAt: new Date().toISOString() });
                    notify(`Active payment processor saved: ${procDraft.activeProcessor.toUpperCase()}.`);
                  }}
                  className="flex-1 h-10 rounded-xl bg-[#0F766E] px-4 font-semibold text-white hover:bg-[#0D625B]"
                >
                  Save Processor
                </button>
              </div>
            </div>
          </section>

          {/* Lemon Squeezy Store, Orders, Subscriptions & Direct Refunds */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Lemon Squeezy Merchant Account, Orders &amp; Direct Refunds
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connected server-side via <code className="font-mono font-semibold">LEMONSQUEEZY_API_KEY</code> so your secret key is never exposed in browser code.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {lsOverview && (
                  <span
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${
                      !lsOverview.configured
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : lsOverview.mode === 'live'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-[#0F766E] dark:text-emerald-400'
                          : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {!lsOverview.configured
                      ? 'KEY NEEDED IN ENV'
                      : lsOverview.mode === 'live'
                        ? 'LIVE MODE ACTIVE'
                        : 'TEST MODE KEY ACTIVE'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void loadLemonSqueezyOverview()}
                  disabled={isLoadingLs}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLs ? 'animate-spin' : ''}`} />
                  {isLoadingLs ? 'Syncing...' : 'Refresh Lemon Squeezy'}
                </button>
              </div>
            </div>

            {!lsOverview?.configured ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 p-4 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                <p className="font-bold">
                  Server Environment Variable <code className="font-mono">LEMONSQUEEZY_API_KEY</code> Not Set Yet
                </p>
                <p className="leading-relaxed">
                  Add <code className="font-mono font-bold">LEMONSQUEEZY_API_KEY</code> in your hosting/Vercel Secrets or local <code className="font-mono">.env</code> and restart the server. Once set, live Lemon Squeezy stores, orders, subscriptions, and 1-click full refunds run right from this screen. (Until your Lemon Squeezy store finishes KYC activation and flips from Test Mode to Live Mode, keys generated in Test Mode work exclusively with Test Mode orders.)
                </p>
              </div>
            ) : lsOverview.error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300">
                Lemon Squeezy API check: <strong>{lsOverview.error}</strong>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3">
                    <p className="text-[11px] text-slate-500">Merchant Account</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {lsOverview.account?.name || 'Connected'} {lsOverview.account?.email ? `(${lsOverview.account.email})` : ''}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3">
                    <p className="text-[11px] text-slate-500">Stores Connected</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {lsOverview.stores.length > 0
                        ? lsOverview.stores.map((s) => `${s.name} (${s.currency})`).join(', ')
                        : 'No stores returned yet'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3">
                    <p className="text-[11px] text-slate-500">Orders &amp; Subscriptions</p>
                    <p className="font-mono font-bold text-[#0F766E] dark:text-emerald-400">
                      {lsOverview.orders.length} Orders · {lsOverview.subscriptions.length} Subscriptions
                    </p>
                  </div>
                </div>

                {lsOverview.orders.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3">Order #</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Product</th>
                          <th className="py-2 pr-3">Total</th>
                          <th className="py-2 pr-3">Mode</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2">Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lsOverview.orders.map((ord) => {
                          const key = `ls-ord-${ord.id}`;
                          const confirming = confirmingRefundKey === key;
                          return (
                            <tr key={ord.id}>
                              <td className="py-2.5 pr-3 font-mono font-semibold">#{ord.orderNumber}</td>
                              <td className="py-2.5 pr-3">{ord.userEmail}</td>
                              <td className="py-2.5 pr-3">{ord.productName}</td>
                              <td className="py-2.5 pr-3 font-mono">{ord.totalFormatted}</td>
                              <td className="py-2.5 pr-3 font-mono text-[11px]">
                                {ord.testMode ? 'TEST' : 'LIVE'}
                              </td>
                              <td className="py-2.5 pr-3 font-mono font-bold uppercase">
                                {ord.refunded ? 'REFUNDED' : ord.statusFormatted}
                              </td>
                              <td className="py-2.5">
                                {ord.refunded ? (
                                  <span className="text-[11px] text-slate-400">Refunded</span>
                                ) : confirming ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={refundingKey === key}
                                      onClick={async () => {
                                        setRefundingKey(key);
                                        try {
                                          const res = await onIssueRefund({
                                            externalOrderId: ord.id,
                                            userEmail: ord.userEmail,
                                            amountUsd: ord.totalUsd,
                                            reason: `Admin refund for Order #${ord.orderNumber}`,
                                            downgradeToFree: true,
                                          });
                                          notify(res.message);
                                          setConfirmingRefundKey(null);
                                          await loadLemonSqueezyOverview();
                                        } finally {
                                          setRefundingKey(null);
                                        }
                                      }}
                                      className="h-7 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white hover:bg-rose-500"
                                    >
                                      {refundingKey === key ? 'Refunding...' : 'Confirm Full Refund'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingRefundKey(null)}
                                      className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingRefundKey(key)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Issue Refund
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {lsOverview.subscriptions.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 overflow-x-auto">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Lemon Squeezy Subscriptions ({lsOverview.subscriptions.length})
                    </h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3">Subscriber</th>
                          <th className="py-2 pr-3">Plan</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Renews / Ends</th>
                          <th className="py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lsOverview.subscriptions.map((sub) => (
                          <tr key={sub.id}>
                            <td className="py-2 pr-3">{sub.userEmail}</td>
                            <td className="py-2 pr-3">{sub.productName}</td>
                            <td className="py-2 pr-3 font-mono font-bold uppercase">{sub.statusFormatted}</td>
                            <td className="py-2 pr-3 font-mono">
                              {sub.renewsAt ? formatDateShort(sub.renewsAt) : sub.endsAt ? formatDateShort(sub.endsAt) : '—'}
                            </td>
                            <td className="py-2">
                              {sub.cancelled ? (
                                <span className="text-[11px] text-slate-400">Cancelled</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={refundingKey === `sub-${sub.id}`}
                                  onClick={() => void handleCancelLsSubscription(sub.id)}
                                  className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  {refundingKey === `sub-${sub.id}` ? 'Cancelling...' : 'Cancel Subscription'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Accounting Exports & Ledger Table */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Transaction &amp; Accounting Ledger ({ledgerTransactions.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Refund/Churn Rate: <span className="font-mono font-bold">{kpis.refundRate}%</span> · Promo Redemptions:{' '}
                  <span className="font-mono font-bold">{kpis.promoRedemptions}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      'prob8-financial-ledger.csv',
                      exportLedgerToCsv(ledgerTransactions),
                      'text/csv;charset=utf-8'
                    )
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      'prob8-quickbooks-export.json',
                      exportLedgerToAccountingJson(ledgerTransactions, 'quickbooks'),
                      'application/json'
                    )
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  QuickBooks JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      'prob8-xero-export.json',
                      exportLedgerToAccountingJson(ledgerTransactions, 'xero'),
                      'application/json'
                    )
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Xero JSON
                </button>
              </div>
            </div>

            {ledgerTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                No checkout transactions recorded yet. Real upgrades from Settings or the Membership modal appear here automatically.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4">User</th>
                      <th className="py-2.5 pr-4">Plan</th>
                      <th className="py-2.5 pr-4">Processor</th>
                      <th className="py-2.5 pr-4">Promo</th>
                      <th className="py-2.5 pr-4">Gross</th>
                      <th className="py-2.5 pr-4">Fees</th>
                      <th className="py-2.5 pr-4">Net</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {ledgerTransactions.map((t) => {
                      const canRefund = t.status === 'paid' && t.grossUsd > 0;
                      const confirming = confirmingRefundKey === t.id;
                      return (
                        <tr key={t.id}>
                          <td className="py-2.5 pr-4">{formatDateShort(t.date)}</td>
                          <td className="py-2.5 pr-4 font-sans">{t.userEmail}</td>
                          <td className="py-2.5 pr-4 font-sans font-semibold">{t.plan}</td>
                          <td className="py-2.5 pr-4 uppercase">{t.processor}</td>
                          <td className="py-2.5 pr-4">{t.promoCode || '—'}</td>
                          <td className="py-2.5 pr-4">{formatCurrency(t.grossUsd)}</td>
                          <td className="py-2.5 pr-4 text-rose-500">{formatCurrency(t.feeUsd)}</td>
                          <td className="py-2.5 pr-4 font-bold text-[#0F766E] dark:text-emerald-400">
                            {formatCurrency(t.netUsd)}
                          </td>
                          <td
                            className={`py-2.5 pr-4 uppercase font-bold ${
                              t.status === 'refunded' ? 'text-rose-500' : ''
                            }`}
                          >
                            {t.status}
                          </td>
                          <td className="py-2.5 font-sans">
                            {canRefund ? (
                              confirming ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={refundingKey === t.id}
                                    onClick={async () => {
                                      setRefundingKey(t.id);
                                      try {
                                        const res = await onIssueRefund({
                                          transactionId: t.id,
                                          externalOrderId: t.externalOrderId,
                                          userEmail: t.userEmail,
                                          amountUsd: t.grossUsd,
                                          reason: 'Admin ledger refund',
                                          downgradeToFree: true,
                                        });
                                        notify(res.message);
                                        setConfirmingRefundKey(null);
                                      } finally {
                                        setRefundingKey(null);
                                      }
                                    }}
                                    className="h-7 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white hover:bg-rose-500"
                                  >
                                    {refundingKey === t.id ? 'Processing...' : 'Confirm Refund'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingRefundKey(null)}
                                    className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-[11px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingRefundKey(t.id)}
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Issue Refund
                                </button>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* PAGE 3: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                User Directory, 1-Click Free Lifetime Grants &amp; Security Controls ({users.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grant Free Lifetime (<span className="font-mono">$0 vip_lifetime</span>) to friends/family, trigger password resets, or suspend abuse.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter users by tier or status"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs font-semibold"
              >
                <option value="all">All Accounts</option>
                <option value="free">Free Tier ($0/mo)</option>
                <option value="pro">Prob8 Pro ($79/mo)</option>
                <option value="vip_lifetime">Prob8 Lifetime ($699 / Free Grant)</option>
                <option value="suspended">Suspended</option>
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  aria-label="Search registered users"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user email or name..."
                  className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-9 pr-3 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 pr-4">Sign-Up</th>
                  <th className="py-2.5 pr-4">Current Plan</th>
                  <th className="py-2.5 pr-4">Change Tier</th>
                  <th className="py-2.5">1-Click Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isFounder = u.email.toLowerCase() === 'busapower07@gmail.com';
                  const suspended = u.status === 'suspended';
                  const isLifetime = u.subscriptionTier === 'vip_lifetime';
                  return (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {u.fullName}
                          {isFounder && (
                            <span className="ml-2 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              [FOUNDER ADMIN]
                            </span>
                          )}
                          {suspended && (
                            <span className="ml-2 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              [SUSPENDED]
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {formatDateShort(u.signedUpAt)}
                      </td>
                      <td className="py-3 pr-4 font-mono font-semibold text-[#0F766E] dark:text-emerald-400">
                        {formatTierLabel(u.subscriptionTier)}
                      </td>
                      <td className="py-3 pr-4">
                        {isFounder ? (
                          <span className="font-mono text-[11px] text-slate-500">Permanent Founder Unlimited</span>
                        ) : (
                          <select
                            aria-label={`Access tier for ${u.email}`}
                            value={u.subscriptionTier}
                            onChange={(e) => onChangeUserTier(u.id, e.target.value as SubscriptionTier)}
                            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs font-semibold"
                          >
                            <option value="free">Free Tier ($0/mo)</option>
                            <option value="pro">Prob8 Pro ($79/mo)</option>
                            <option value="vip_lifetime">Prob8 Lifetime ($699)</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3">
                        {!isFounder && (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onChangeUserTier(u.id, isLifetime ? 'free' : 'vip_lifetime');
                                notify(
                                  isLifetime
                                    ? `Revoked Free Lifetime from ${u.email}.`
                                    : `Granted Free Lifetime access to ${u.email}.`
                                );
                              }}
                              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-semibold ${
                                isLifetime
                                  ? 'bg-indigo-600 text-white'
                                  : 'border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                              }`}
                            >
                              <Gift className="h-3.5 w-3.5" />
                              {isLifetime ? 'Lifetime Granted' : 'Grant Free Lifetime'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onTriggerPasswordReset(u.id);
                                notify(`Password reset flagged for ${u.email} on next login.`);
                              }}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {u.forcePasswordChange ? 'Reset Pending' : 'Reset Password'}
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-semibold ${
                                suspended
                                  ? 'bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                                  : 'border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                              }`}
                            >
                              {suspended ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                              {suspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PAGE 4: AFFILIATE MANAGEMENT + DOSSIER INSPECTOR */}
      {activeTab === 'affiliates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Affiliate Directory */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo-500" />
                Affiliate Partners ({affiliates.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                30% Pro recurring ($23.70/mo) + $150 flat Lifetime. Click any partner to inspect compliance dossier &amp; issue payouts.
              </p>
            </div>

            <div className="space-y-2.5">
              {affiliates.map((aff) => {
                const selected = selectedAffiliate?.id === aff.id;
                return (
                  <button
                    key={aff.id}
                    type="button"
                    onClick={() => setSelectedAffiliateId(aff.id)}
                    className={`w-full rounded-xl border p-3.5 text-left transition-colors space-y-1 ${
                      selected
                        ? 'border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-950/25'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#090D16]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {aff.partnerName} ({aff.stateOfResidence})
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {formatCurrency(aff.commissionsOwedUsd)} owed
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {aff.partnerEmail} · Code: {aff.referralCode}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {aff.clicks} clicks · {aff.signups} signups · {aff.activeProConversions} Pro ·{' '}
                      {aff.lifetimeConversions} Lifetime
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right: Affiliate Dossier Inspector */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {!selectedAffiliate ? (
              <p className="text-xs text-slate-500">Select an affiliate partner to inspect their dossier.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      Affiliate Dossier · {selectedAffiliate.stateOfResidence} Jurisdiction
                    </span>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {selectedAffiliate.partnerName}
                    </h2>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {selectedAffiliate.partnerEmail} · https://prob8.app/?ref={selectedAffiliate.referralCode}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(
                          `https://prob8.app/?ref=${selectedAffiliate.referralCode}`
                        );
                        setCopiedCode(selectedAffiliate.referralCode);
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold"
                    >
                      {copiedCode === selectedAffiliate.referralCode ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy Link
                    </button>

                    <button
                      type="button"
                      disabled={selectedAffiliate.commissionsOwedUsd <= 0}
                      onClick={() => {
                        onMarkAffiliatePaid(selectedAffiliate.id);
                        notify(
                          `Marked ${formatCurrency(selectedAffiliate.commissionsOwedUsd)} paid to ${selectedAffiliate.partnerEmail}.`
                        );
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0F766E] px-3.5 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-45"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Paid ({formatCurrency(selectedAffiliate.commissionsOwedUsd)})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] text-slate-500">Tax Form</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedAffiliate.taxFormType} ({selectedAffiliate.signedTaxForm ? 'Signed' : 'Pending'})
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] text-slate-500">FTC 16 CFR Part 255</p>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedAffiliate.signedFtcDisclosure ? 'Certified' : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] text-slate-500">Payout Route</p>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {selectedAffiliate.payoutMethod}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] text-slate-500">Total Paid</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(selectedAffiliate.totalPaidUsd)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 space-y-2 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileCheck2 className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                    Executed Agreement Signature: &ldquo;{selectedAffiliate.signedFullName}&rdquo; ·{' '}
                    {formatDateShort(selectedAffiliate.signedAt)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Payout Destination: {selectedAffiliate.payoutDestination} · Eligibility:{' '}
                    {isEligibleForAffiliatePayout(selectedAffiliate)
                      ? 'Meets $50 threshold'
                      : 'Under $50 threshold (can still be paid manually)'}
                  </p>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                    {buildStateLocalizedAffiliateAgreement({
                      partnerName: selectedAffiliate.partnerName,
                      stateOfResidence: selectedAffiliate.stateOfResidence,
                      referralCode: selectedAffiliate.referralCode,
                    })}
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Payout History ({selectedAffiliate.payoutHistory.length})
                  </h3>
                  {selectedAffiliate.payoutHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No payouts issued yet for this affiliate partner.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {selectedAffiliate.payoutHistory.map((p) => (
                        <li key={p.id} className="py-2 flex items-center justify-between">
                          <span>
                            {formatDateShort(p.paidAt)} · {p.method} · {p.referenceNote}
                          </span>
                          <span className="font-mono font-bold text-[#0F766E] dark:text-emerald-400">
                            {formatCurrency(p.amountUsd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* PAGE 5: PROMO CODES & UNIVERSAL INTEGRATIONS */}
      {activeTab === 'promos_integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Promo Code Engine */}
            <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Promo Code Engine ({promoCodes.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Discounts apply cleanly to Prob8 Pro ($79/mo) &amp; Prob8 Lifetime ($699).
                </p>
              </div>

              <form onSubmit={handleCreatePromo} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="promo-code-input" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Promo Code
                  </label>
                  <input
                    id="promo-code-input"
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value)}
                    placeholder="e.g. PROBATE50"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="promo-discount-input" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Discount Percentage (%)
                  </label>
                  <input
                    id="promo-discount-input"
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="promo-trial-input" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Free Trial Length (Days)
                  </label>
                  <input
                    id="promo-trial-input"
                    type="number"
                    min={0}
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="promo-limit-input" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Max Redemptions Allowed
                  </label>
                  <input
                    id="promo-limit-input"
                    type="number"
                    min={1}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="promo-expires-input" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Code Expiration Date
                  </label>
                  <input
                    id="promo-expires-input"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-900 dark:bg-emerald-600 px-3 font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Promo
                  </button>
                </div>
              </form>

              {promoCodes.length === 0 ? (
                <p className="text-xs text-slate-500">No promo codes created yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {promoCodes.map((pc) => (
                    <li key={pc.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{pc.code}</span>
                        <p className="text-slate-500 dark:text-slate-400">
                          {pc.discountPct}% off · {pc.freeTrialDays}d trial · {pc.timesUsed}/{pc.usageLimit} used
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTogglePromoActive(pc.id)}
                        className={`rounded-lg px-2.5 py-1 font-semibold ${
                          pc.isActive
                            ? 'bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {pc.isActive ? 'Active' : 'Paused'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Universal Custom Integration & Webhook Builder */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plug className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Universal Custom Integration &amp; Webhook Builder ({customIntegrations.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect any app (QuickBooks, Xero, Zapier, Make, n8n, Slack, or custom REST API) with custom headers, event triggers, field mapping, and live test pings.
                </p>
              </div>

              <form onSubmit={handleCreateCustomIntegration} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="int-name" className="block font-semibold text-slate-700 dark:text-slate-300">
                    App / Integration Name
                  </label>
                  <input
                    id="int-name"
                    type="text"
                    required
                    value={intName}
                    onChange={(e) => setIntName(e.target.value)}
                    placeholder="e.g. QuickBooks / Make / Zapier Sync"
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5"
                  />
                </div>
                <div>
                  <label htmlFor="int-category" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <input
                    id="int-category"
                    type="text"
                    value={intCategory}
                    onChange={(e) => setIntCategory(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="int-url" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Webhook / API Endpoint URL
                  </label>
                  <input
                    id="int-url"
                    type="url"
                    required
                    value={intUrl}
                    onChange={(e) => setIntUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="int-trigger" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Trigger Event
                  </label>
                  <select
                    id="int-trigger"
                    value={intEvent}
                    onChange={(e) => setIntEvent(e.target.value as CustomIntegration['triggerEvent'])}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-semibold"
                  >
                    <option value="all_events">All Events</option>
                    <option value="pro_signup">Prob8 Pro ($79/mo) Signup</option>
                    <option value="lifetime_purchase">Prob8 Lifetime ($699) Purchase</option>
                    <option value="deal_closed">Pipeline Deal Closed</option>
                    <option value="new_probate_lead">New Probate Lead Saved</option>
                    <option value="skip_trace">Built-In Skip Trace Complete</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="int-auth" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Optional Authorization Header
                  </label>
                  <input
                    id="int-auth"
                    type="text"
                    value={intAuthHeader}
                    onChange={(e) => setIntAuthHeader(e.target.value)}
                    placeholder="Bearer ..."
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="int-map-src" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Source Field Mapping
                  </label>
                  <input
                    id="int-map-src"
                    type="text"
                    value={intMapSource}
                    onChange={(e) => setIntMapSource(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="int-map-dst" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Target Payload Key
                  </label>
                  <input
                    id="int-map-dst"
                    type="text"
                    value={intMapTarget}
                    onChange={(e) => setIntMapTarget(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0F766E] px-4 font-semibold text-white hover:bg-[#0D625B]"
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Integration / Webhook
                </button>
              </form>

              {customIntegrations.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {customIntegrations.map((item) => (
                    <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {item.name} · <span className="font-normal text-slate-500">{item.category}</span>
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 truncate max-w-md">
                          {item.endpointUrl} ({item.triggerEvent})
                        </p>
                        {item.lastStatus && (
                          <p className="text-[11px] text-[#0F766E] dark:text-emerald-400">{item.lastStatus}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleTestCustomIntegration(item)}
                          disabled={testingIntId === item.id}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 font-semibold"
                        >
                          <Send className="h-3 w-3" />
                          {testingIntId === item.id ? 'Testing...' : 'Test Ping'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCustomIntegration(item.id)}
                          className={`h-8 rounded-lg px-2.5 font-semibold ${
                            item.enabled
                              ? 'bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {item.enabled ? 'Enabled' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => onDeleteCustomIntegration(item.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Environment Auto-Detection (Zero Manual VAPID Inputs) & Google Play Readiness */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-indigo-500" />
                    Vercel &amp; Supabase Runtime Status ({envPlatform})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    VAPID Web Push &amp; Built-In Skip Trace are auto-managed with zero keys required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadEnvStatus()}
                  disabled={isRefreshingEnv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3 text-xs font-semibold text-white"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingEnv ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="space-y-2.5">
                {envVars.map((v) => (
                  <div
                    key={v.name}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <code className="font-mono font-bold text-slate-900 dark:text-white">{v.name}</code>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.purpose}</p>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-bold shrink-0 ${
                        v.configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {v.configured ? 'ACTIVE' : 'SET IN VERCEL'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-3 text-xs">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                Google Play Store &amp; Direct Android APK Checklist
              </h2>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li>1. Capacitor ID configured: <code className="font-mono font-bold">com.prob8.app</code> (App Name: Prob8).</li>
                <li>2. Digital Asset Links ready at <code className="font-mono">/.well-known/assetlinks.json</code> (replace placeholder SHA-256 fingerprint from Play App Signing).</li>
                <li>3. Offline fallback &amp; PWA service worker active (<code className="font-mono">/offline.html</code>, maskable 512x512 icon).</li>
                <li>4. Build Android App Bundle (<code className="font-mono">.aab</code>) or direct APK locally with <code className="font-mono">npm run build:android</code>, sign with upload keystore, and submit to Google Play Console Production track.</li>
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* PAGE 6: USER SUGGESTIONS, CONTACT INBOX & REFUND PROCESSING */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Inbox Queue */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
                  Support, Suggestions &amp; Refund Inbox ({filteredTickets.length})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Direct user submissions from in-app embedded forms.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <select
                aria-label="Filter inbox by category"
                value={ticketCatFilter}
                onChange={(e) => setTicketCatFilter(e.target.value as typeof ticketCatFilter)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-semibold"
              >
                <option value="all">All Categories</option>
                <option value="refund_request">Refund Requests</option>
                <option value="feature_suggestion">Feature Suggestions</option>
                <option value="billing_support">Billing Questions</option>
                <option value="bug_report">Bug / Data Reports</option>
                <option value="general">General Contact</option>
              </select>

              <select
                aria-label="Filter inbox by status"
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value as typeof ticketStatusFilter)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                aria-label="Search support inbox"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Search user email, subject, order #..."
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-9 pr-3 text-xs"
              />
            </div>

            {filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                No user messages or refund requests match this filter yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {filteredTickets.map((tkt) => {
                  const selected = selectedTicket?.id === tkt.id;
                  return (
                    <button
                      key={tkt.id}
                      type="button"
                      onClick={() => setSelectedTicketId(tkt.id)}
                      className={`w-full rounded-xl border p-3.5 text-left space-y-1 transition-colors ${
                        selected
                          ? 'border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-950/25'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#090D16]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase">
                        <span
                          className={`font-bold ${
                            tkt.category === 'refund_request'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {SUPPORT_CATEGORY_LABELS[tkt.category]}
                        </span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          {SUPPORT_STATUS_LABELS[tkt.status]}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tkt.subject}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {tkt.userEmail} · {formatDateShort(tkt.createdAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Ticket Inspector, Reply & 1-Click Refund Execution */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
            {!selectedTicket ? (
              <p className="text-xs text-slate-500">
                Select a message from the inbox queue to review details, reply in-app, or issue a refund.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <span className="font-mono text-[11px] font-bold uppercase text-[#0F766E] dark:text-emerald-400">
                      {SUPPORT_CATEGORY_LABELS[selectedTicket.category]} · {SUPPORT_STATUS_LABELS[selectedTicket.status]}
                    </span>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {selectedTicket.subject}
                    </h2>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      From {selectedTicket.userName} ({selectedTicket.userEmail}) · Plan: {formatTierLabel(selectedTicket.subscriptionTier)} · {formatDateShort(selectedTicket.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.message}
                </div>

                {(selectedTicket.category === 'refund_request' ||
                  selectedTicket.relatedTransactionId ||
                  selectedTicket.relatedOrderId ||
                  selectedTicket.requestedRefundUsd) && (
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 space-y-3 text-xs">
                    {(() => {
                      const matchedTxn = findRefundableTransactionForTicket(
                        selectedTicket,
                        ledgerTransactions
                      );
                      const resolvedOrderId =
                        overrideOrderId.trim() ||
                        selectedTicket.relatedOrderId ||
                        matchedTxn?.externalOrderId ||
                        '';

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              Refund Processing Desk
                            </p>
                            {selectedTicket.requestedRefundUsd !== undefined && (
                              <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                                Requested: {formatCurrency(selectedTicket.requestedRefundUsd)}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="admin-refund-order-id"
                                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                              >
                                Lemon Squeezy Order ID (Optional for live API refund)
                              </label>
                              <input
                                id="admin-refund-order-id"
                                type="text"
                                value={overrideOrderId}
                                onChange={(e) => setOverrideOrderId(e.target.value)}
                                placeholder={matchedTxn?.externalOrderId || 'e.g. 42001'}
                                className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 font-mono text-xs"
                              />
                            </div>
                            <div className="flex items-end">
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer h-9">
                                <input
                                  type="checkbox"
                                  checked={downgradeOnRefund}
                                  onChange={(e) => setDowngradeOnRefund(e.target.checked)}
                                  className="h-4 w-4 accent-[#0F766E]"
                                />
                                Downgrade account to Free Tier on refund
                              </label>
                            </div>
                          </div>

                          {matchedTxn && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                              Matched Ledger Charge: {matchedTxn.plan} · {formatCurrency(matchedTxn.grossUsd)} ({matchedTxn.processor.toUpperCase()}) on {formatDateShort(matchedTxn.date)}
                            </p>
                          )}

                          <button
                            type="button"
                            disabled={isProcessingTicket || selectedTicket.status === 'refunded'}
                            onClick={async () => {
                              setIsProcessingTicket(true);
                              try {
                                const result = await onIssueRefund({
                                  transactionId: matchedTxn?.id,
                                  externalOrderId: resolvedOrderId || undefined,
                                  ticketId: selectedTicket.id,
                                  userEmail: selectedTicket.userEmail,
                                  amountUsd: selectedTicket.requestedRefundUsd ?? matchedTxn?.grossUsd,
                                  reason: replyDraft.trim() || `Refund approved for ${selectedTicket.userEmail}`,
                                  downgradeToFree: downgradeOnRefund,
                                });
                                notify(result.message);
                                if (result.ok) {
                                  setStatusDraft('refunded');
                                  if (!replyDraft.trim()) {
                                    setReplyDraft('Your refund has been issued and confirmed.');
                                  }
                                  await loadLemonSqueezyOverview();
                                }
                              } finally {
                                setIsProcessingTicket(false);
                              }
                            }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {selectedTicket.status === 'refunded'
                              ? 'Already Refunded'
                              : isProcessingTicket
                                ? 'Issuing Refund...'
                                : resolvedOrderId
                                  ? `Issue Lemon Squeezy Refund (#${resolvedOrderId})`
                                  : 'Approve Refund & Reconcile Ledger'}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                <form onSubmit={(e) => void handleSaveTicketUpdate(e)} className="space-y-3 text-xs">
                  <div>
                    <label
                      htmlFor="admin-ticket-reply"
                      className="block font-semibold text-slate-700 dark:text-slate-300"
                    >
                      In-App Response to User (Visible inside their Request Tracker)
                    </label>
                    <textarea
                      id="admin-ticket-reply"
                      rows={4}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Write a clear reply or resolution note for this user..."
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] p-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      aria-label="Update ticket status"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as SupportTicketStatus)}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-semibold"
                    >
                      <option value="open">Status: Open</option>
                      <option value="in_review">Status: In Review</option>
                      <option value="resolved">Status: Resolved</option>
                      <option value="refunded">Status: Refunded</option>
                    </select>

                    <button
                      type="submit"
                      disabled={isProcessingTicket}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-5 font-semibold text-white hover:bg-[#0D625B] disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isProcessingTicket ? 'Saving...' : 'Save Reply & Status'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
