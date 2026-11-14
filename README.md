# Prob8 — National Probate Real Estate Search, Live Auctions, Underwriting & Relational CRM

Prob8 is an enterprise SaaS platform covering all **50 US States + Washington, D.C.** (`3,143 counties`) with live probate search, interactive Google Maps & Street View inspection, multi-strategy real estate underwriting, built-in zero-key skip tracing, relational People CRM, Portfolio & Field Route tracking, a 5-page Founder Admin Command Center, and a standalone Affiliate Partner portal.

## Subscription Tiers
- **Free Tier ($0/mo):** Nationwide search across all 50 states + DC, up to 5 unlocked dossiers per county (10 nationwide).
- **Prob8 Pro ($79/mo + 7-Day Free Trial):** 100% nationwide dossier access, Built-In Zero-Key Skip Tracing, live County Auctions, Prob8 Multi-Strategy Underwriting, and localized contracts.
- **Prob8 Lifetime ($699 One-Time or Admin Free Grant):** Permanent Pro unlock with zero recurring fees.

## Zero-Key Architecture
- **Web Push Notifications:** Server silently generates and persists an EC P-256 VAPID keypair at boot (`GET /api/push/public-key`). Users simply toggle Push Alerts On/Off in Settings.
- **Built-In Skip Trace Engine:** `POST /api/skip-trace` enriches contacts using County Assessor, Public Voter Registry, and Open OSINT lookups with zero external vendor keys required.
- **Local & Free AI:** Built-In templates, Managed Gemini Free Tier, Browser WebLLM, and 1-Click Hardware-Matched Local Ollama setup.

## Payment Processors (Merchant-of-Record & Direct Gateways)
Supports Merchant-of-Record (**Lemon Squeezy**, **Paddle**) and Direct Merchant Processors (**Square**, **Authorize.Net**, **PayPal Commerce**), configurable in **Admin -> Financial & Accounting**.

## Affiliate Program
- **Commission Plan:** 30% recurring monthly (`$23.70/mo`) on Prob8 Pro + `$150` flat on Prob8 Lifetime.
- **Attribution & Payouts:** 60-day cookie (`?ref=CODE`), `$50` minimum monthly PayPal or ACH payouts, state-localized partner agreement, FTC 16 CFR Part 255 disclosure, and IRS W-9/W-8BEN certification.

## Production Deployment (Vercel + Supabase 1M+ Scale)
1. Link Supabase inside Vercel Integrations to auto-populate `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Run `/supabase/migrations/001_initial_schema.sql` and `/supabase/migrations/002_enterprise_scale_affiliates_payments.sql`.
3. Enable **Supavisor Transaction Pooling** (port `6543` with `?pgbouncer=true`) for serverless concurrency.
4. Set `VITE_GOOGLE_MAPS_API_KEY` (and optional `GEMINI_API_KEY`) in Vercel Environment Variables.

## Android APK & Google Play Publishing
- App ID: `com.prob8.app` (`capacitor.config.ts`).
- Digital Asset Links template: `/public/.well-known/assetlinks.json`.
- Build bundle locally: `npm run build:android` -> open `android/` in Android Studio -> **Generate Signed Bundle (`.aab`)** -> upload to Google Play Console.

## Pushing to GitHub
```bash
git remote add origin https://github.com/<your-username>/prob8.git
git push -u origin main
```
