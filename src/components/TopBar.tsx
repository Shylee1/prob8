import React, { useState } from 'react';
import {
  BookOpen,
  Briefcase,
  Building,
  Compass,
  Download,
  Link2,
  Menu,
  MessageSquare,
  Moon,
  Navigation,
  Scale,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { SubscriptionTier } from '../types';

export type AppView =
  | 'discover'
  | 'buyboxes'
  | 'pipeline'
  | 'people'
  | 'portfolio'
  | 'route'
  | 'docs'
  | 'affiliate'
  | 'support'
  | 'settings'
  | 'admin'
  | 'legal';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  pipelineCount: number;
  peopleCount: number;
  portfolioCount: number;
  buyBoxCount: number;
  openSupportCount?: number;
  subscriptionTier: SubscriptionTier;
  isAdmin: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenBillingOrAccount: () => void;
  userEmail: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onNavigate,
  pipelineCount,
  peopleCount,
  portfolioCount,
  buyBoxCount,
  openSupportCount = 0,
  subscriptionTier,
  isAdmin,
  isDark,
  onToggleTheme,
  onOpenBillingOrAccount,
  userEmail,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const navItems: Array<{
    id: AppView;
    label: string;
    count?: number;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }> = [
    { id: 'discover', label: 'Discover', icon: <Compass className="h-4 w-4" /> },
    { id: 'buyboxes', label: 'Buy-Boxes & Push Alerts', count: buyBoxCount, icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: 'pipeline', label: 'Property Pipeline', count: pipelineCount, icon: <Briefcase className="h-4 w-4" /> },
    { id: 'people', label: 'People CRM', count: peopleCount, icon: <Users className="h-4 w-4" /> },
    { id: 'portfolio', label: 'Portfolio', count: portfolioCount, icon: <Building className="h-4 w-4" /> },
    { id: 'route', label: 'Field Route', icon: <Navigation className="h-4 w-4" /> },
    { id: 'docs', label: 'Documentation & Help', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'support', label: 'Contact, Suggestions & Refunds', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'affiliate', label: 'Become an Affiliate', icon: <Link2 className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    {
      id: 'admin',
      label: 'Admin Dashboard',
      count: isAdmin && openSupportCount > 0 ? openSupportCount : undefined,
      icon: <ShieldAlert className="h-4 w-4" />,
      adminOnly: true,
    },
  ];

  const handleNav = (view: AppView) => {
    onNavigate(view);
    setDrawerOpen(false);
  };

  const tierLabel =
    subscriptionTier === 'vip_lifetime'
      ? 'VIP Lifetime'
      : subscriptionTier === 'pro'
        ? 'Prob8 Pro'
        : 'Upgrade to Pro';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
          {/* Left: Compact Hamburger Menu Trigger + Prob8 Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Navigation Menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => handleNav('discover')}
              className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
            >
              <img src="/icon.svg?v=3" alt="Prob8 Logo" className="h-7 w-7 rounded-lg" />
              <span>Prob8</span>
            </button>
          </div>

          {/* Right: Theme Toggle + Install + Tier CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                aria-label="Install Prob8 App"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 h-9 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </button>
            )}
            {!isInstalled && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                aria-label="Install on iOS"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 h-9 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <Smartphone className="h-3.5 w-3.5" />
                iOS PWA
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenBillingOrAccount}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 h-10 text-xs font-semibold transition-colors whitespace-nowrap ${
                subscriptionTier === 'vip_lifetime'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : subscriptionTier === 'pro'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500'
                    : 'bg-[#0F766E] text-white hover:bg-[#0D625B]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {tierLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Compact Slide-Out Hamburger Drawer (272px max width) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close Navigation Backdrop"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
          />
          <aside
            aria-label="Prob8 Navigation Drawer"
            className="relative z-10 flex h-full w-[272px] max-w-[82vw] flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4">
              <div className="flex items-center gap-2">
                <img src="/icon.svg?v=3" alt="Prob8 Logo" className="h-7 w-7 rounded-lg" />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Prob8
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                    {userEmail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close Navigation Menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111827]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>

            {/* Compact Drawer Footer: Legal & App Distribution */}
            <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <button
                type="button"
                onClick={() => handleNav('legal')}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  activeView === 'legal'
                    ? 'bg-slate-100 dark:bg-[#111827] text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111827]'
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Legal, Privacy &amp; CCPA Disclosures</span>
              </button>

              <a
                href="#android-apk-install"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('settings');
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0F766E]"
              >
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400" />
                  Android APK &amp; iOS PWA
                </span>
                <Download className="h-3.5 w-3.5 text-slate-400" />
              </a>
            </div>
          </aside>
        </div>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Install Prob8 on iOS
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong> for native full-screen field access.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 dark:bg-emerald-600 py-2.5 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
