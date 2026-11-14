-- Prob8 Nationwide Probate Real Estate, Live Auctions, Portfolio & Relational CRM Schema
-- Designed for Vercel + Supabase (Auth, PostgreSQL, RLS, Storage, pg_cron, Realtime)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'vip_lifetime')),
  trial_ends_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  push_subscription JSONB,
  ai_config JSONB NOT NULL DEFAULT '{"mode":"built_in","provider":"gemini","modelName":"prob8-standard","autoConfigured":true}'::jsonb,
  affiliate_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper function checking admin privileges safely
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-create profile row when any new user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, affiliate_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'Investor'), '@', 1)),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. BUY_BOXES (Multi-Profile Investor Criteria & Free Web Push Alerts)
CREATE TABLE IF NOT EXISTS public.buy_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_push BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buy_boxes_user_active ON public.buy_boxes (user_id, is_active);

CREATE TRIGGER set_buy_boxes_updated_at
  BEFORE UPDATE ON public.buy_boxes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. PROPERTIES (Normalized Nationwide Probate, Auction & Assessor Records)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apn TEXT NOT NULL,
  county_fips TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  zip TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'auction', 'purged_sold')),
  property_type TEXT NOT NULL DEFAULT 'Single-Family',
  beds INTEGER,
  baths NUMERIC(4,1),
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  probate_case_number TEXT,
  filing_date DATE,
  probate_price NUMERIC(14,2),
  court_name TEXT,
  decedent_name TEXT,
  executor_name TEXT,
  probate_attorney TEXT,
  assessor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  zillow_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  redfin_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  avm_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  estimated_equity NUMERIC(14,2) NOT NULL DEFAULT 0,
  equity_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  mortgage_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_delinquent BOOLEAN NOT NULL DEFAULT FALSE,
  is_vacant BOOLEAN NOT NULL DEFAULT FALSE,
  pre_foreclosure_overlap BOOLEAN NOT NULL DEFAULT FALSE,
  media_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
  comps JSONB NOT NULL DEFAULT '[]'::jsonb,
  auction_data JSONB,
  is_watched_auction BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purged_at TIMESTAMPTZ,
  UNIQUE (state, county, apn)
);

CREATE INDEX IF NOT EXISTS idx_properties_geo_status ON public.properties (status, state, county, city, zip);
CREATE INDEX IF NOT EXISTS idx_properties_filing ON public.properties (filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_properties_watched_auction ON public.properties (is_watched_auction) WHERE is_watched_auction = TRUE;

-- 4. PEOPLE (Bidirectional Relational Contacts CRM)
CREATE TABLE IF NOT EXISTS public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'Executor', 'Administrator', 'Heir', 'Probate Attorney',
    'Cash Buyer', 'Contractor', 'Title Agent'
  )),
  phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  mailing_address TEXT,
  notes TEXT,
  skip_traced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_user ON public.people (user_id, role);

CREATE TRIGGER set_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. PROPERTY_PEOPLE (Many-to-Many Junction Table)
CREATE TABLE IF NOT EXISTS public.property_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_property_people_person ON public.property_people (user_id, person_id);
CREATE INDEX IF NOT EXISTS idx_property_people_property ON public.property_people (user_id, property_id);

-- 6. PIPELINE_DEALS
CREATE TABLE IF NOT EXISTS public.pipeline_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'New Probate Lead' CHECK (stage IN (
    'New Probate Lead',
    'Skip Traced',
    'Contacted',
    'Engaged / Negotiating',
    'Offer Sent',
    'Under Contract',
    'Closed / Dead'
  )),
  offer_amount NUMERIC(14,2),
  arv_estimate NUMERIC(14,2),
  rehab_estimate NUMERIC(14,2),
  underwriting_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_follow_up DATE,
  task_title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_user_stage ON public.pipeline_deals (user_id, stage);

CREATE TRIGGER set_pipeline_deals_updated_at
  BEFORE UPDATE ON public.pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. PORTFOLIO_ASSETS (Owned Real Estate & Cash-Flow Tracking)
CREATE TABLE IF NOT EXISTS public.portfolio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  asset_class TEXT NOT NULL DEFAULT 'Single-Family',
  acquisition_date DATE,
  purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_rent NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  occupancy_pct NUMERIC(5,2) NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_portfolio_assets_updated_at
  BEFORE UPDATE ON public.portfolio_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. ENGAGEMENTS (Calls, SMS, Emails, Direct Mail, LOIs, Offers, Skip Trace, Field Notes)
CREATE TABLE IF NOT EXISTS public.engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call', 'sms', 'email', 'direct_mail', 'loi', 'offer', 'note', 'skip_trace', 'auction_bid')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound', 'internal')),
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagements_user_prop ON public.engagements (user_id, property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagements_user_person ON public.engagements (user_id, person_id, created_at DESC);

-- 9. DOCUMENTS (Supabase Storage References)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('loi', 'purchase_contract', 'county_form', 'probate_filing', 'underwriting_report')),
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PROMO_CODES & AFFILIATE_REFERRALS (Admin Engine)
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_pct INTEGER NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  free_trial_days INTEGER NOT NULL DEFAULT 7,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER NOT NULL DEFAULT 100,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  active_pro_conversions INTEGER NOT NULL DEFAULT 0,
  commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 25.0,
  monthly_payout_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. COUNTY_SYNC_LOGS (11:00 AM & 3:00 PM Daily Audit Log)
CREATE TABLE IF NOT EXISTS public.county_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_slot TEXT NOT NULL,
  counties_scanned INTEGER NOT NULL DEFAULT 0,
  new_filings_ingested INTEGER NOT NULL DEFAULT 0,
  sold_properties_purged INTEGER NOT NULL DEFAULT 0,
  auctions_updated INTEGER NOT NULL DEFAULT 0,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buy_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.county_sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: own read/update OR Admin full user management
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_current_user_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = id OR public.is_current_user_admin());

-- User-scoped tables
CREATE POLICY "buy_boxes_all_own" ON public.buy_boxes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "people_all_own" ON public.people FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "property_people_all_own" ON public.property_people FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pipeline_deals_all_own" ON public.pipeline_deals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "portfolio_assets_all_own" ON public.portfolio_assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "engagements_all_own" ON public.engagements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_all_own" ON public.documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Properties: active & auction records readable by authenticated users (purged_sold excluded from standard queries)
CREATE POLICY "properties_select_authenticated" ON public.properties FOR SELECT TO authenticated USING (status <> 'purged_sold' OR public.is_current_user_admin());
CREATE POLICY "properties_insert_authenticated" ON public.properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "properties_update_authenticated" ON public.properties FOR UPDATE TO authenticated USING (true);

-- Promo Codes & Sync Logs: Admin managed
CREATE POLICY "promo_codes_read_active" ON public.promo_codes FOR SELECT TO authenticated USING (is_active = TRUE OR public.is_current_user_admin());
CREATE POLICY "promo_codes_admin_write" ON public.promo_codes FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "affiliate_referrals_own_or_admin" ON public.affiliate_referrals FOR ALL USING (auth.uid() = partner_user_id OR public.is_current_user_admin()) WITH CHECK (auth.uid() = partner_user_id OR public.is_current_user_admin());
CREATE POLICY "county_sync_logs_admin_read" ON public.county_sync_logs FOR SELECT TO authenticated USING (true);

-- Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossier-documents', 'dossier-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dossier_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dossier_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dossier_docs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buy_boxes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.engagements;

-- FOUNDER ADMIN SEED (busapower07@gmail.com / temp password '123' / mandatory password reset on first login)
DO $$
DECLARE
  founder_uid UUID;
BEGIN
  SELECT id INTO founder_uid FROM auth.users WHERE email = 'busapower07@gmail.com' LIMIT 1;

  IF founder_uid IS NULL THEN
    founder_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      founder_uid,
      'authenticated',
      'authenticated',
      'busapower07@gmail.com',
      crypt('123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Prob8 Founder Admin"}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    subscription_tier,
    is_admin,
    force_password_change,
    affiliate_code
  ) VALUES (
    founder_uid,
    'busapower07@gmail.com',
    'Prob8 Founder Admin',
    'vip_lifetime',
    TRUE,
    TRUE,
    'FOUNDER8'
  )
  ON CONFLICT (id) DO UPDATE SET
    is_admin = TRUE,
    subscription_tier = 'vip_lifetime',
    force_password_change = TRUE;
END $$;

-- TWICE-DAILY COUNTY SYNC & AUTO-PURGE SCHEDULES (11:00 AM & 3:00 PM Daily via pg_cron)
-- Note: Replace <YOUR_SUPABASE_PROJECT_REF> and <YOUR_ANON_OR_SERVICE_JWT> when deploying cron triggers.
SELECT cron.schedule(
  'prob8-county-sync-11am',
  '0 11 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.edge_function_base_url', true) || '/county-sync-purge',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"slot":"11:00 AM Daily Sync"}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'prob8-county-sync-3pm',
  '0 15 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.edge_function_base_url', true) || '/county-sync-purge',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"slot":"3:00 PM Daily Sync"}'::jsonb
    );
  $$
);
