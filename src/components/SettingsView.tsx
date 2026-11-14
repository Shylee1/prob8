import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Cpu,
  Download,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Tag,
  Terminal,
  Zap,
} from 'lucide-react';
import type {
  AIConfig,
  EmailConfig,
  NotificationPreferences,
  PaymentProcessorId,
  PromoCode,
  UserProfile,
} from '../types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../services/dataService';
import {
  detectClientHardwareProfile,
  type DeviceHardwareProfile,
} from '../utils/ollamaHardware';
import {
  PAYMENT_PROCESSORS,
  calculateCheckoutTotals,
  formatTierLabel,
  validatePromoCode,
} from '../utils/paymentAdapter';

interface SettingsViewProps {
  profile: UserProfile;
  isDark: boolean;
  activeProcessor: PaymentProcessorId;
  promoCodes?: PromoCode[];
  onToggleTheme: () => void;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onCheckoutPlan: (plan: 'pro' | 'vip_lifetime', isTrial?: boolean, promoCode?: string) => void;
  onOpenAffiliatePortal: () => void;
  onSignOut: () => void;
}

const BYO_PROVIDERS: Array<{
  id: AIConfig['provider'];
  label: string;
  defaultModel: string;
  placeholder: string;
}> = [
  { id: 'openai', label: 'OpenAI (ChatGPT / GPT-4.1)', defaultModel: 'gpt-4.1-mini', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-20250514', placeholder: 'sk-ant-...' },
  { id: 'gemini', label: 'Google Gemini (BYO)', defaultModel: 'gemini-2.5-flash', placeholder: 'AIza...' },
  { id: 'grok', label: 'xAI (Grok)', defaultModel: 'grok-3-mini', placeholder: 'xai-...' },
  { id: 'openrouter', label: 'OpenRouter (Any Model)', defaultModel: 'meta-llama/llama-3.3-70b-instruct', placeholder: 'sk-or-...' },
  { id: 'custom', label: 'Custom OpenAI-Compatible URL', defaultModel: 'local-model', placeholder: 'Optional bearer token' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  isDark,
  activeProcessor,
  promoCodes = [],
  onToggleTheme,
  onUpdateProfile,
  onCheckoutPlan,
  onOpenAffiliatePortal,
  onSignOut,
}) => {
  const safeAiConfig = profile?.aiConfig ?? {
    mode: 'built_in' as const,
    provider: 'prob8_free' as const,
    modelName: 'Prob8 Standard Templates',
    autoConfigured: true,
  };
  const safeEmailConfig = profile?.emailConfig ?? {
    provider: 'mailto' as const,
    fromName: profile?.fullName || 'Prob8 Investor',
    fromEmail: profile?.email || '',
    connected: true,
  };
  const notifPrefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(profile?.notificationPreferences ?? {}),
  };

  const [aiMode, setAiMode] = useState<AIConfig['mode']>(safeAiConfig.mode ?? 'built_in');
  const [byoProvider, setByoProvider] = useState<AIConfig['provider']>(
    safeAiConfig.mode === 'byo_api' ? safeAiConfig.provider : 'openai'
  );
  const [byoModel, setByoModel] = useState<string>(
    safeAiConfig.mode === 'byo_api' ? safeAiConfig.modelName || 'gpt-4.1-mini' : 'gpt-4.1-mini'
  );
  const [byoApiKey, setByoApiKey] = useState<string>(safeAiConfig.apiKey ?? '');
  const [customEndpoint, setCustomEndpoint] = useState<string>(safeAiConfig.customEndpoint ?? '');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(
    safeAiConfig.mode === 'ollama_local'
      ? safeAiConfig.customEndpoint || 'http://localhost:11434'
      : 'http://localhost:11434'
  );

  // Per-User Email Service Configuration
  const [emailProvider, setEmailProvider] = useState<EmailConfig['provider']>(
    safeEmailConfig.provider ?? 'mailto'
  );
  const [emailFromName, setEmailFromName] = useState<string>(
    safeEmailConfig.fromName ?? profile?.fullName ?? 'Prob8 Investor'
  );
  const [emailFromAddress, setEmailFromAddress] = useState<string>(
    safeEmailConfig.fromEmail ?? profile?.email ?? ''
  );
  const [emailSmtpHost, setEmailSmtpHost] = useState<string>(
    safeEmailConfig.smtpHost ?? 'smtp.gmail.com'
  );
  const [emailSmtpPort, setEmailSmtpPort] = useState<number>(
    safeEmailConfig.smtpPort ?? 587
  );
  const [emailApiKeyOrPass, setEmailApiKeyOrPass] = useState<string>(
    safeEmailConfig.apiKeyOrPassword ?? ''
  );
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState<string>('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | undefined>(undefined);
  const [promoFeedback, setPromoFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [hardwareSpec, setHardwareSpec] = useState<DeviceHardwareProfile>(() =>
    detectClientHardwareProfile()
  );
  const [ollamaRunning, setOllamaRunning] = useState<boolean>(false);
  const [isAutoInstallingOllama, setIsAutoInstallingOllama] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/ollama/system-spec')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ollamaRunning?: boolean } | null) => {
        if (!active || !data) return;
        if (typeof data.ollamaRunning === 'boolean') {
          setOllamaRunning(data.ollamaRunning);
        }
      })
      .catch(() => {
        // client hardware profile already computed safely
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleNotification = (key: keyof NotificationPreferences) => {
    const nextPrefs: NotificationPreferences = {
      ...notifPrefs,
      [key]: !notifPrefs[key],
    };
    onUpdateProfile({ notificationPreferences: nextPrefs });
  };

  const hasProAccess =
    profile?.subscriptionTier === 'pro' || profile?.subscriptionTier === 'vip_lifetime';

  const processorMeta =
    PAYMENT_PROCESSORS.find((p) => p.id === activeProcessor) ?? PAYMENT_PROCESSORS[0];
  const appliedPromoCheck = appliedPromoCode
    ? validatePromoCode(appliedPromoCode, promoCodes)
    : null;
  const activeDiscountPct = appliedPromoCheck?.ok ? appliedPromoCheck.discountPct : 0;
  const effectiveTrialDays = Math.max(
    7,
    appliedPromoCheck?.ok ? appliedPromoCheck.freeTrialDays : 7
  );
  const proPreview = calculateCheckoutTotals({
    plan: 'pro',
    processor: activeProcessor,
    discountPct: activeDiscountPct,
  });
  const lifetimePreview = calculateCheckoutTotals({
    plan: 'vip_lifetime',
    processor: activeProcessor,
    discountPct: activeDiscountPct,
  });

  const handleApplyPromo = () => {
    const check = validatePromoCode(promoInput, promoCodes);
    if (!check.ok || !check.promo) {
      setAppliedPromoCode(undefined);
      setPromoFeedback({ ok: false, text: check.reason || 'Invalid promo code.' });
      return;
    }
    setAppliedPromoCode(check.promo.code);
    setPromoInput(check.promo.code);
    const trialPart =
      check.freeTrialDays > 7 ? ` + ${check.freeTrialDays}-day extended trial` : '';
    setPromoFeedback({
      ok: true,
      text: `${check.promo.code} applied: ${check.discountPct}% off${trialPart}.`,
    });
  };

  const handleSelectBuiltInFree = () => {
    setAiMode('built_in');
    onUpdateProfile({
      aiConfig: {
        mode: 'built_in',
        provider: 'prob8_free',
        modelName: 'Prob8 Standard Templates',
        autoConfigured: true,
        lastTestedAt: new Date().toISOString(),
      },
    });
    setAiStatusMsg('Free built-in Prob8 underwriting & script templates active.');
  };

  const handleSelectGeminiFree = async () => {
    setIsTestingAi(true);
    setAiStatusMsg(null);
    try {
      const resp = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini_free',
          modelName: 'Google Gemini Free Tier (Prob8 Managed)',
        }),
      });
      const data = (await resp.json()) as { ok: boolean; message: string };
      setAiMode('gemini_free');
      onUpdateProfile({
        aiConfig: {
          mode: 'gemini_free',
          provider: 'gemini_free',
          modelName: 'Google Gemini Free Tier (Prob8 Managed)',
          autoConfigured: true,
          lastTestedAt: new Date().toISOString(),
        },
      });
      setAiStatusMsg(data.message);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleAutoConfigureLocalAI = async () => {
    setIsTestingAi(true);
    setAiStatusMsg(null);
    try {
      const resp = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'webllm_local',
          modelName: 'Llama-3.2-3B-Instruct-q4f16 (WebLLM Browser)',
        }),
      });
      const data = (await resp.json()) as { ok: boolean; message: string };
      setAiMode('local_webllm');
      onUpdateProfile({
        aiConfig: {
          mode: 'local_webllm',
          provider: 'webllm_local',
          modelName: 'Llama-3.2-3B-Instruct-q4f16 (WebLLM)',
          autoConfigured: true,
          lastTestedAt: new Date().toISOString(),
        },
      });
      setAiStatusMsg(data.message);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleOneClickInstallOllama = async () => {
    setIsAutoInstallingOllama(true);
    setAiStatusMsg(null);
    const { os, recommendedBaseModel, recommendedModelTag } = hardwareSpec;
    try {
      const resp = await fetch('/api/ai/ollama/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: ollamaEndpoint,
          baseModel: recommendedBaseModel,
          modelTag: recommendedModelTag,
        }),
      });
      const data = (await resp.json()) as {
        ok: boolean;
        daemonDetected?: boolean;
        message: string;
      };

      if (data.daemonDetected) {
        setOllamaRunning(true);
        setAiMode('ollama_local');
        onUpdateProfile({
          aiConfig: {
            mode: 'ollama_local',
            provider: 'ollama_local',
            modelName: `${recommendedModelTag} (${recommendedBaseModel})`,
            customEndpoint: ollamaEndpoint,
            autoConfigured: true,
            lastTestedAt: new Date().toISOString(),
          },
        });
        setAiStatusMsg(data.message);
      } else {
        const bootstrapUrl = `/api/ai/ollama/bootstrap-script?os=${encodeURIComponent(os)}&baseModel=${encodeURIComponent(recommendedBaseModel)}&modelTag=${encodeURIComponent(recommendedModelTag)}`;
        const link = document.createElement('a');
        link.href = bootstrapUrl;
        link.download =
          os === 'windows'
            ? 'prob8-ollama-setup.ps1'
            : os === 'macos'
              ? 'prob8-ollama-setup.command'
              : 'prob8-ollama-setup.sh';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setAiMode('ollama_local');
        onUpdateProfile({
          aiConfig: {
            mode: 'ollama_local',
            provider: 'ollama_local',
            modelName: `${recommendedModelTag} (${recommendedBaseModel})`,
            customEndpoint: ollamaEndpoint,
            autoConfigured: true,
            lastTestedAt: new Date().toISOString(),
          },
        });
        setAiStatusMsg(
          `1-Click ${os.toUpperCase()} Installer downloaded for ${recommendedModelTag} (${recommendedBaseModel}). Run once — Prob8 auto-connects to localhost:11434.`
        );
      }
    } finally {
      setIsAutoInstallingOllama(false);
    }
  };

  const handleTestAndSaveByo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingAi(true);
    setAiStatusMsg(null);
    try {
      const resp = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: byoProvider,
          modelName: byoModel,
          apiKey: byoApiKey,
          customEndpoint: byoProvider === 'custom' ? customEndpoint : undefined,
        }),
      });
      const data = (await resp.json()) as { ok: boolean; message: string };
      if (!resp.ok || !data.ok) {
        setAiStatusMsg(data.message || 'Check your API key or endpoint URL.');
        return;
      }
      setAiMode('byo_api');
      onUpdateProfile({
        aiConfig: {
          mode: 'byo_api',
          provider: byoProvider,
          modelName: byoModel,
          apiKey: byoApiKey.trim(),
          customEndpoint: byoProvider === 'custom' ? customEndpoint.trim() : undefined,
          autoConfigured: true,
          lastTestedAt: new Date().toISOString(),
        },
      });
      setAiStatusMsg(data.message);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailFromAddress.trim()) {
      setEmailStatusMsg('Enter a From Email Address to save.');
      return;
    }
    const nextEmailConfig: EmailConfig = {
      provider: emailProvider,
      fromName: emailFromName.trim() || profile?.fullName || 'Prob8 Investor',
      fromEmail: emailFromAddress.trim(),
      smtpHost:
        emailProvider === 'smtp' || emailProvider === 'gmail' || emailProvider === 'outlook'
          ? emailSmtpHost.trim()
          : undefined,
      smtpPort:
        emailProvider === 'smtp' || emailProvider === 'gmail' || emailProvider === 'outlook'
          ? emailSmtpPort
          : undefined,
      apiKeyOrPassword: emailApiKeyOrPass.trim() || undefined,
      connected: true,
      lastTestedAt: new Date().toISOString(),
    };
    onUpdateProfile({ emailConfig: nextEmailConfig });
    setEmailStatusMsg(
      `Connected ${emailProvider.toUpperCase()} (${nextEmailConfig.fromEmail}). Ready to email executors from any Property Dossier.`
    );
  };

  // Zero-Key Auto-Generated VAPID Web Push Single On/Off Toggle
  const isPushActive = Boolean(profile?.pushToken && notifPrefs.pushEnabled);
  const handleToggleWebPush = async () => {
    setIsTogglingPush(true);
    setPushStatus(null);
    try {
      if (isPushActive) {
        onUpdateProfile({
          pushToken: undefined,
          notificationPreferences: { ...notifPrefs, pushEnabled: false },
        });
        setPushStatus('Push notifications paused cleanly.');
        return;
      }

      // Silently obtain auto-generated public key from Prob8 backend
      await fetch('/api/push/public-key').catch(() => null);

      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission().catch(() => 'default');
        if (perm === 'denied') {
          setPushStatus(
            'Browser notifications are blocked in site permissions. Allow notifications in your browser bar to activate.'
          );
          return;
        }
      }

      onUpdateProfile({
        pushToken: `web-push-${Date.now().toString(36)}`,
        notificationPreferences: { ...notifPrefs, pushEnabled: true },
      });
      setPushStatus('Push alerts enabled automatically for Buy-Boxes, Auctions & Skip Traces.');
    } finally {
      setIsTogglingPush(false);
    }
  };

  const handleDownloadAndroidBundle = () => {
    const manifestGuide = `Prob8 Android APK & Google Play Distribution Manifest
App ID: com.prob8.app
App Name: Prob8
Package Type: Capacitor Android APK / AAB
Version: 2.1.0

Quick Install Options:
1. Chrome / Edge on Android: Open Prob8 -> Tap "Install App" for full-screen offline GPS routing & Web Push.
2. Android Studio / Capacitor Build: Run "npm run build:android" and upload generated app-release.aab to Google Play Console.`;
    const blob = new Blob([manifestGuide], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Prob8-Android-Install-Guide.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formattedTrialEnd = profile?.trialEndsAt
    ? (() => {
        const d = new Date(profile.trialEndsAt);
        return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US');
      })()
    : null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Settings, Free AI Engine &amp; User Email
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Signed in as <span className="font-mono font-semibold">{profile?.email || 'Investor'}</span> · Affiliate Code{' '}
            <span className="font-mono font-semibold text-[#0F766E] dark:text-emerald-400">
              {profile?.affiliateCode || 'P8PARTNER'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAffiliatePortal}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
          >
            <Link2 className="h-4 w-4" />
            Affiliate Portal (30% Recurring)
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3.5 text-xs font-semibold text-slate-800 dark:text-white"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* 1. No-Code Plug & Play AI Setup */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
              No-Code &ldquo;Plug &amp; Play&rdquo; AI Model Setup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active Engine:{' '}
              <span className="font-mono font-semibold text-[#0F766E] dark:text-emerald-400">
                {safeAiConfig.modelName || 'Prob8 Standard Templates'}
              </span>
            </p>
          </div>
          {aiStatusMsg && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {aiStatusMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
              aiMode === 'built_in'
                ? 'border-[#0F766E] bg-[#0F766E]/5 dark:bg-emerald-950/25'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                1. Prob8 Built-In Free
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Zero setup or API keys. Instant underwriting math, LOIs, and scripts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectBuiltInFree}
              className="w-full h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Use Free Built-In Engine
            </button>
          </div>

          <div
            className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
              aiMode === 'gemini_free'
                ? 'border-[#0F766E] bg-[#0F766E]/5 dark:bg-emerald-950/25'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                2. Google Gemini Free
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Managed Google Gemini Free Tier for live probate deal briefs &amp; localized contracts at $0 cost.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSelectGeminiFree()}
              disabled={isTestingAi}
              className="w-full h-9 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Activate Free Gemini AI
            </button>
          </div>

          <div
            className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
              aiMode === 'local_webllm'
                ? 'border-[#0F766E] bg-[#0F766E]/5 dark:bg-emerald-950/25'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                3. Browser Local AI (WebLLM)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                1-click auto-configures an in-browser local LLM. Zero API fees and works offline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleAutoConfigureLocalAI()}
              disabled={isTestingAi}
              className="w-full h-9 rounded-xl bg-[#0F766E] text-xs font-semibold text-white hover:bg-[#0D625B]"
            >
              Auto-Configure WebLLM
            </button>
          </div>

          <div
            className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
              aiMode === 'ollama_local'
                ? 'border-[#0F766E] bg-[#0F766E]/5 dark:bg-emerald-950/25'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-indigo-500" />
                  4. 1-Click Local Ollama
                </h3>
                <span
                  className={`font-mono text-[10px] font-bold uppercase ${
                    ollamaRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {ollamaRunning ? 'ONLINE' : 'AUTO-INSTALL'}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2 text-[11px] space-y-0.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Detected: {hardwareSpec.os.toUpperCase()} · {hardwareSpec.cpuCores} Cores · {hardwareSpec.ramGb} GB RAM
                </p>
                <p className="font-mono text-indigo-600 dark:text-indigo-400 truncate">
                  Optimal: {hardwareSpec.recommendedModelTag} ({hardwareSpec.recommendedBaseModel})
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  {hardwareSpec.tierReason}
                </p>
              </div>
              <input
                type="url"
                aria-label="Ollama local server URL"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 font-mono text-[11px]"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleOneClickInstallOllama()}
              disabled={isAutoInstallingOllama}
              className="w-full h-9 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {isAutoInstallingOllama
                ? 'Configuring Ollama...'
                : ollamaRunning
                  ? `Auto-Install ${hardwareSpec.recommendedModelTag}`
                  : '1-Click Auto-Install Ollama & Model'}
            </button>
          </div>
        </div>

        <form onSubmit={handleTestAndSaveByo} className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 items-end">
          <div>
            <label htmlFor="ai-provider" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              5. External AI Provider (Optional BYO Key)
            </label>
            <select
              id="ai-provider"
              value={byoProvider}
              onChange={(e) => {
                const next = e.target.value as AIConfig['provider'];
                setByoProvider(next);
                const meta = BYO_PROVIDERS.find((p) => p.id === next);
                if (meta) setByoModel(meta.defaultModel);
              }}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {BYO_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-model" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Model ID
            </label>
            <input
              id="ai-model"
              type="text"
              value={byoModel}
              onChange={(e) => setByoModel(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="ai-key" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {byoProvider === 'custom' ? 'Endpoint URL' : 'API Key'}
            </label>
            {byoProvider === 'custom' ? (
              <input
                id="ai-key"
                type="url"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs text-slate-900 dark:text-white"
              />
            ) : (
              <input
                id="ai-key"
                type="password"
                value={byoApiKey}
                onChange={(e) => setByoApiKey(e.target.value)}
                placeholder={BYO_PROVIDERS.find((p) => p.id === byoProvider)?.placeholder || 'Paste key...'}
                className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs text-slate-900 dark:text-white"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={isTestingAi}
            className="h-10 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {isTestingAi ? 'Testing...' : 'Test & Save Model'}
          </button>
        </form>
      </section>

      {/* 2. Per-User Email Service Integration */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
              Connect Your Email Service (Per-User Outreach)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send probate outreach &amp; LOIs directly from your own Gmail, Outlook, Resend Free (3,000 emails/mo), or Custom SMTP inside any Property Dossier.
            </p>
          </div>
          {emailStatusMsg && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {emailStatusMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveEmailConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="email-provider" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email Provider
            </label>
            <select
              id="email-provider"
              value={emailProvider}
              onChange={(e) => {
                const p = e.target.value as EmailConfig['provider'];
                setEmailProvider(p);
                if (p === 'gmail') {
                  setEmailSmtpHost('smtp.gmail.com');
                  setEmailSmtpPort(587);
                } else if (p === 'outlook') {
                  setEmailSmtpHost('smtp.office365.com');
                  setEmailSmtpPort(587);
                }
              }}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 text-xs font-semibold"
            >
              <option value="mailto">Device Mail App (Zero Config)</option>
              <option value="gmail">Gmail / Google Workspace</option>
              <option value="outlook">Outlook / Microsoft 365</option>
              <option value="resend">Resend API (Free 3,000/mo)</option>
              <option value="smtp">Custom Domain SMTP</option>
            </select>
          </div>

          <div>
            <label htmlFor="email-from-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sender Display Name
            </label>
            <input
              id="email-from-name"
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs"
            />
          </div>

          <div>
            <label htmlFor="email-from-addr" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              From Email Address
            </label>
            <input
              id="email-from-addr"
              type="email"
              value={emailFromAddress}
              onChange={(e) => setEmailFromAddress(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="email-secret" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {emailProvider === 'resend'
                ? 'Resend API Key'
                : emailProvider === 'mailto'
                  ? 'Optional Signature Note'
                  : 'App Password / SMTP Secret'}
            </label>
            <input
              id="email-secret"
              type={emailProvider === 'mailto' ? 'text' : 'password'}
              value={emailApiKeyOrPass}
              onChange={(e) => setEmailApiKeyOrPass(e.target.value)}
              placeholder={emailProvider === 'resend' ? 're_...' : emailProvider === 'mailto' ? 'Optional' : 'App password...'}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs"
            />
          </div>

          {(emailProvider === 'smtp' || emailProvider === 'gmail' || emailProvider === 'outlook') && (
            <>
              <div>
                <label htmlFor="smtp-host" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  SMTP Host
                </label>
                <input
                  id="smtp-host"
                  type="text"
                  value={emailSmtpHost}
                  onChange={(e) => setEmailSmtpHost(e.target.value)}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="smtp-port" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  SMTP Port
                </label>
                <input
                  id="smtp-port"
                  type="number"
                  value={emailSmtpPort}
                  onChange={(e) => setEmailSmtpPort(Number(e.target.value) || 587)}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono text-xs"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2 lg:col-span-2 flex justify-end">
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#0F766E] px-5 text-xs font-semibold text-white hover:bg-[#0D625B]"
            >
              Save &amp; Connect Email Account
            </button>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3. Unified Tier Billing & Payment Processor */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
              Subscription &amp; Self-Serve Billing
            </h2>
            <span className="font-mono text-xs font-bold uppercase text-[#0F766E] dark:text-emerald-400">
              {formatTierLabel(profile?.subscriptionTier ?? 'free')}
            </span>
          </div>

          {billingStatus && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
              {billingStatus}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3.5 space-y-1 text-xs">
            <p className="font-semibold text-slate-900 dark:text-white">
              Checkout Processor: {processorMeta.name} ({processorMeta.typeLabel})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {profile?.subscriptionTier === 'vip_lifetime'
                ? 'Permanent Prob8 Lifetime unlocked ($0 recurring forever). Full 50-state + DC dossiers, Built-In Skip Trace, Prob8 Underwriter & Live Auctions.'
                : formattedTrialEnd
                  ? `7-Day Free Trial active through ${formattedTrialEnd}. Converts to $79/mo thereafter.`
                  : 'Pro unlocks 100% of all 3,143 US counties, Built-In Zero-Key Skip Trace, Live Auctions, Prob8 Underwriting & localized contracts.'}
            </p>
          </div>

          {profile?.subscriptionTier !== 'vip_lifetime' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    aria-label="Billing promo code"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Have a promo code? (e.g. PROBATE50)"
                    className="flex-1 min-w-0 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 font-mono text-xs uppercase text-slate-900 dark:text-white"
                  />
                  {appliedPromoCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedPromoCode(undefined);
                        setPromoInput('');
                        setPromoFeedback(null);
                      }}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Clear
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="h-8 rounded-lg bg-[#0F766E] px-3 text-xs font-semibold text-white hover:bg-[#0D625B]"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {promoFeedback && (
                  <p
                    className={`text-[11px] font-semibold ${
                      promoFeedback.ok
                        ? 'text-[#0F766E] dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {promoFeedback.text}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {profile?.subscriptionTier === 'free' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onCheckoutPlan('pro', true, appliedPromoCode);
                        setBillingStatus(
                          `${effectiveTrialDays}-Day Free Trial of Prob8 Pro ($${proPreview.grossUsd}/mo after trial) activated.`
                        );
                      }}
                      className="h-10 rounded-xl bg-[#0F766E] px-3 text-xs font-semibold text-white hover:bg-[#0D625B]"
                    >
                      Start {effectiveTrialDays}-Day Free Trial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCheckoutPlan('pro', false, appliedPromoCode);
                        setBillingStatus(
                          `Prob8 Pro ($${proPreview.grossUsd}/mo) processed via ${processorMeta.name}.`
                        );
                      }}
                      className="h-10 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3 text-xs font-semibold text-white"
                    >
                      Upgrade Pro (${proPreview.grossUsd}/mo)
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onCheckoutPlan('vip_lifetime', false, appliedPromoCode);
                    setBillingStatus(
                      `Prob8 Lifetime ($${lifetimePreview.grossUsd} One-Time) unlocked permanently via ${processorMeta.name}.`
                    );
                  }}
                  className="sm:col-span-2 h-10 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
                >
                  Unlock Prob8 Lifetime (${lifetimePreview.grossUsd} One-Time — Zero Recurring Fees)
                </button>

                {profile?.subscriptionTier === 'pro' && !profile?.isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ subscriptionTier: 'free', trialEndsAt: undefined });
                      setBillingStatus('Subscription paused and switched cleanly to Free Tier ($0/mo).');
                    }}
                    className="sm:col-span-2 h-9 rounded-xl border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    One-Click Pause / Switch to Free Tier
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 4. Single Push Notifications Toggle & Android/iOS Distribution */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
            Push Alerts &amp; Mobile App Distribution
          </h2>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Instant Push Notifications
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Zero setup required. Receive Buy-Box filings &amp; Auction alerts across desktop, iOS &amp; Android.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPushActive}
              disabled={isTogglingPush}
              onClick={() => void handleToggleWebPush()}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold shrink-0 transition-colors ${
                isPushActive
                  ? 'bg-[#0F766E] text-white'
                  : 'border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#090D16] text-slate-700 dark:text-slate-200'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              {isTogglingPush ? 'Updating...' : isPushActive ? 'On' : 'Off'}
            </button>
          </div>
          {pushStatus && (
            <p className="text-xs font-medium text-[#0F766E] dark:text-emerald-400">{pushStatus}</p>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Android Direct APK &amp; Google Play Bundle
              </span>
              <button
                type="button"
                onClick={handleDownloadAndroidBundle}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Download APK Guide
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              iOS users: Open Prob8 in Safari &rarr; tap <strong>Share</strong> &rarr; <strong>Add to Home Screen</strong> for fullscreen offline GPS routing.
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400" />
            {hasProAccess
              ? 'Full Pro Telemetry, Built-In Skip Trace & Prob8 Underwriting Active'
              : 'Free Tier Active ($0/mo)'}
          </p>
        </section>
      </div>

      {/* 5. Comprehensive Notification Preferences Matrix */}
      <section
        aria-label="Notification Preferences Matrix"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5"
      >
        <div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
            Comprehensive Notification &amp; Alert Toggles
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control delivery channels, filing alerts, live auction timers, pipeline follow-ups, TCPA quiet hours, and system updates across desktop &amp; mobile.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {(
            [
              {
                key: 'pushEnabled',
                label: 'Browser & Mobile Push Notifications',
                desc: 'Deliver instant native Web Push alerts for unlocked events.',
              },
              {
                key: 'emailDigestEnabled',
                label: 'Email Notifications & Daily Digest',
                desc: 'Send summary emails to your connected address.',
              },
              {
                key: 'buyBoxNewFilings',
                label: 'Buy-Box New Probate Matches',
                desc: 'Alert immediately after M–F 11 AM / 4 PM sync finds matching estates.',
              },
              {
                key: 'courthouseSyncSummary',
                label: 'Courthouse Sync Run Summary',
                desc: 'Digest of newly indexed counties across all 50 states + DC.',
              },
              {
                key: 'purgedSoldAlerts',
                label: 'Sold / Closed Parcel Purge Summary',
                desc: 'Notify when stale or closed listings are archived from Buy-Boxes.',
              },
              {
                key: 'auctionOverbidCountdown',
                label: 'Auction Overbid & Countdown Alerts',
                desc: 'Real-time outbid & statutory upset-bid deadline countdown notices.',
              },
              {
                key: 'priceDropAndMao',
                label: 'Price Drops & MAO Opportunity Pings',
                desc: 'Flag when probate asking price drops below your 70% Rule MAO.',
              },
              {
                key: 'taxDelinquencyAndPreFc',
                label: 'Tax Delinquency & Pre-Foreclosure Overlap',
                desc: 'Alert on parcels showing dual probate + tax lien distress.',
              },
              {
                key: 'skipTraceComplete',
                label: 'Built-In Skip Trace Completion',
                desc: 'Alert when phone/email append completes on an executor or heir.',
              },
              {
                key: 'emailRepliesAndFollowUps',
                label: 'LOI & Email Engagement Follow-Ups',
                desc: 'Remind when an Offer Sent / LOI deal hits 48h without reply.',
              },
              {
                key: 'courtHearingDeadlines',
                label: 'Probate Court Hearing Reminders',
                desc: '24-hour and 72-hour alerts prior to confirmation hearings.',
              },
              {
                key: 'pipelineStageUpdates',
                label: 'Pipeline Stage & Team Handoffs',
                desc: 'Track deal movement across your acquisition Kanban stages.',
              },
              {
                key: 'fieldRouteNearbyLeads',
                label: 'Field Route GPS Proximity Pings',
                desc: 'Ping when Driving-for-Dollars within 0.5 miles of a saved pipeline lead.',
              },
              {
                key: 'affiliateAndSecurity',
                label: 'Affiliate Payout & Security Alerts',
                desc: 'Commission milestones, payouts, password & session notices.',
              },
            ] as Array<{ key: keyof NotificationPreferences; label: string; desc: string }>
          ).map((item) => {
            const enabled = Boolean(notifPrefs[item.key]);
            return (
              <label
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3.5 cursor-pointer hover:border-[#0F766E]/40 transition-colors"
              >
                <div className="space-y-0.5 pr-2">
                  <span className="block font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {item.desc}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleToggleNotification(item.key)}
                  className="mt-1 h-4 w-4 rounded accent-[#0F766E] shrink-0"
                />
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
};
