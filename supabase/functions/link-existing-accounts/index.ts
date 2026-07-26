import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerRole } = await admin.rpc('get_user_role', { _user_id: caller.id });
    if (!callerRole || !['system_admin', 'agency_admin'].includes(callerRole)) {
      return json({ error: 'Only administrators can run the account backfill' }, 403);
    }

    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byEmail = new Map<string, string>();
    for (const u of usersPage?.users ?? []) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }

    let caregiversLinked = 0;
    let clientsLinked = 0;

    const { data: caregivers } = await admin
      .from('caregivers').select('id, email, agency_id').is('user_id', null);
    for (const c of caregivers ?? []) {
      const uid = c.email ? byEmail.get(c.email.toLowerCase()) : undefined;
      if (!uid) continue;
      await admin.from('caregivers').update({ user_id: uid }).eq('id', c.id);
      await admin.from('user_roles')
        .upsert({ user_id: uid, role: 'caregiver', agency_id: c.agency_id }, { onConflict: 'user_id,role' });
      caregiversLinked++;
    }

    const { data: clients } = await admin
      .from('clients').select('id, email, agency_id').is('user_id', null);
    for (const c of clients ?? []) {
      const uid = c.email ? byEmail.get(c.email.toLowerCase()) : undefined;
      if (!uid) continue;
      await admin.from('clients').update({ user_id: uid }).eq('id', c.id);
      await admin.from('user_roles')
        .upsert({ user_id: uid, role: 'client', agency_id: c.agency_id }, { onConflict: 'user_id,role' });
      clientsLinked++;
    }

    return json({ success: true, caregiversLinked, clientsLinked });
  } catch (error) {
    console.error('link-existing-accounts error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
