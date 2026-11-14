import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertPayload {
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    county: string;
    zip: string;
    avm_value: number;
    estimated_equity: number;
    equity_pct: number;
    probate_case_number: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { property } = (await req.json()) as AlertPayload;
    const { data: activeBoxes, error } = await supabase
      .from('buy_boxes')
      .select('*, profiles(id, push_subscription, subscription_tier)')
      .eq('is_active', true)
      .eq('alert_push', true);

    if (error) throw error;

    const dispatches: Array<{ buyBoxId: string; userId: string; status: string }> = [];

    for (const box of activeBoxes ?? []) {
      const f = box.filters || {};
      const stateMatch = !f.states?.length || f.states.includes(property.state);
      const equityMatch = !f.minEquityPct || property.equity_pct >= f.minEquityPct;
      if (!stateMatch || !equityMatch) continue;

      const profile = box.profiles;
      if (profile?.push_subscription?.endpoint) {
        dispatches.push({
          buyBoxId: box.id,
          userId: profile.id,
          status: 'web_push_queued',
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, dispatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
