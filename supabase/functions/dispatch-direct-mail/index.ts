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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }

    const { propertyId, recipientName, mailingAddress, templateType, letterBody } = await req.json();

    const trackingId = `USPS-CP-${Date.now().toString(36).toUpperCase()}`;

    const { data: engagement, error } = await supabase
      .from('engagements')
      .insert({
        user_id: user.id,
        property_id: propertyId,
        channel: 'direct_mail',
        direction: 'outbound',
        summary: `Dispatched ${templateType} to ${recipientName} (${mailingAddress})`,
        metadata: { trackingId, templateType, letterBody },
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, trackingId, engagement }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
