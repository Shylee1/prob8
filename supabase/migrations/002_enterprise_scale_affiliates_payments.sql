-- Prob8 Enterprise Scale, Multi-Processor Payments, Universal Integrations, Auto-VAPID & Affiliate Compliance Schema
-- Connection Pooling Recommendation: Configure Supavisor Transaction Mode (port 6543 + ?pgbouncer=true) for 1M+ concurrent serverless reads.

-- 1. High-Scale Composite B-Tree & GIN Indexes on properties
CREATE INDEX IF NOT EXISTS idx_properties_state_county_status
  ON public.properties (state, county, status, filing_date DESC);

CREATE INDEX IF NOT EXISTS idx_properties_zip_status
  ON public.properties (zip, status);

CREATE INDEX IF NOT EXISTS idx_properties_filing_date_id
  ON public.properties (filing_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_properties_search_gin
  ON public.properties USING GIN (
    to_tsvector(
      'english',
      coalesce(address, '') || ' ' || coalesce(city, '') || ' ' || coalesce(county, '') || ' ' || coalesce(state, '') || ' ' || coalesce(zip, '')
    )
  );

-- 2. Cursor-Based Keyset Pagination RPC for Zero-Offset Lag at Scale
CREATE OR REPLACE FUNCTION public.prob8_search_properties_cursor(
  p_state text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_cursor_filing_date date DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 60
)
RETURNS SETOF public.properties
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.properties
  WHERE (p_state IS NULL OR state = p_state)
    AND (p_county IS NULL OR county ILIKE p_county)
    AND status <> 'purged_sold'
    AND (
      p_cursor_filing_date IS NULL
      OR (filing_date, id) < (p_cursor_filing_date, p_cursor_id)
    )
  ORDER BY filing_date DESC, id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

-- 3. Multi-Processor Payment Transactions Ledger (Lemon Squeezy, Paddle, Square, Authorize.Net, PayPal)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  plan text NOT NULL,
  processor text NOT NULL CHECK (processor IN ('lemonsqueezy', 'paddle', 'square', 'authorizenet', 'paypal', 'admin_grant')),
  promo_code text,
  gross_usd numeric(10, 2) NOT NULL DEFAULT 0,
  fee_usd numeric(10, 2) NOT NULL DEFAULT 0,
  net_usd numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('paid', 'refunded', 'trial')),
  affiliate_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at
  ON public.payment_transactions (created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Universal Custom Integrations & Webhooks
CREATE TABLE IF NOT EXISTS public.custom_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  endpoint_url text NOT NULL,
  trigger_event text NOT NULL,
  auth_header text,
  field_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_integrations ENABLE ROW LEVEL SECURITY;

-- 5. Affiliate Partners, State-Localized Agreements & Monthly Payout History
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  partner_email text UNIQUE NOT NULL,
  state_of_residence text NOT NULL,
  payout_method text NOT NULL CHECK (payout_method IN ('PayPal', 'ACH Bank Transfer')),
  payout_destination text NOT NULL,
  tax_form_type text NOT NULL CHECK (tax_form_type IN ('W-9', 'W-8BEN')),
  signed_full_name text NOT NULL,
  signed_state_agreement boolean NOT NULL DEFAULT false,
  signed_ftc_disclosure boolean NOT NULL DEFAULT false,
  signed_tax_form boolean NOT NULL DEFAULT false,
  signed_at timestamptz NOT NULL DEFAULT now(),
  referral_code text UNIQUE NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  signups int NOT NULL DEFAULT 0,
  active_pro_conversions int NOT NULL DEFAULT 0,
  lifetime_conversions int NOT NULL DEFAULT 0,
  commissions_owed_usd numeric(10, 2) NOT NULL DEFAULT 0,
  total_paid_usd numeric(10, 2) NOT NULL DEFAULT 0,
  payout_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

-- 6. Server-Managed Auto-Generated Web Push VAPID Keys
CREATE TABLE IF NOT EXISTS public.vapid_keys (
  id text PRIMARY KEY DEFAULT 'default',
  public_key text NOT NULL,
  private_key_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;
