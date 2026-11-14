import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: watchedAuctions, error } = await supabase
      .from('properties')
      .select('id, address, auction_data')
      .eq('status', 'auction')
      .eq('is_watched_auction', true);

    if (error) throw error;

    const updatedIds: string[] = [];
    for (const item of watchedAuctions ?? []) {
      const current = item.auction_data || {};
      const nextPayload = {
        ...current,
        lastPolledAt: new Date().toISOString(),
      };
      await supabase
        .from('properties')
        .update({ auction_data: nextPayload, last_synced_at: new Date().toISOString() })
        .eq('id', item.id);
      updatedIds.push(item.id);
    }

    return new Response(JSON.stringify({ ok: true, polledCount: updatedIds.length, updatedIds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
