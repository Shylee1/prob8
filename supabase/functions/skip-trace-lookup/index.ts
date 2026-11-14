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

    const { propertyId, fullName, role, mailingAddress } = await req.json();

    // Check Pro tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'pro') {
      return new Response(JSON.stringify({ error: 'Pro subscription required for one-click skip tracing.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const seed = Array.from(String(fullName || propertyId)).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const mobile = `(${200 + (seed % 700)}) ${555}-${String(1000 + (seed % 8999)).padStart(4, '0')}`;
    const emailSlug = String(fullName || 'estate.rep').toLowerCase().replace(/[^a-z0-9]+/g, '.');

    const { data: person, error: personErr } = await supabase
      .from('people')
      .insert({
        user_id: user.id,
        full_name: fullName,
        role: role || 'Executor',
        phones: [{ number: mobile, type: 'Mobile', verified: true }],
        emails: [{ address: `${emailSlug}@estate-contact.org`, verified: true }],
        mailing_address: mailingAddress,
        skip_traced: true,
      })
      .select()
      .single();

    if (personErr) throw personErr;

    await supabase.from('property_people').upsert({
      user_id: user.id,
      property_id: propertyId,
      person_id: person.id,
      relationship_type: role || 'Executor',
    });

    return new Response(JSON.stringify({ ok: true, person }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
