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
    if (!callerRole || !['system_admin', 'agency_admin', 'manager', 'hr_staff'].includes(callerRole)) {
      return json({ error: 'You do not have permission to review registrations' }, 403);
    }

    const { data: callerProfile } = await admin
      .from('profiles').select('agency_id').eq('id', caller.id).single();
    if (!callerProfile?.agency_id) return json({ error: 'Your profile is missing an agency' }, 400);
    const agencyId = callerProfile.agency_id as string;

    const body = await req.json().catch(() => ({}));
    const registrationId: string | undefined = body.registrationId;
    const action: string = body.action ?? 'approve';
    const rejectionReason: string | null = body.rejectionReason ?? null;

    if (!registrationId || !['approve', 'reject'].includes(action)) {
      return json({ error: 'registrationId and a valid action are required' }, 400);
    }

    const { data: reg, error: regError } = await admin
      .from('caregiver_registrations').select('*').eq('id', registrationId).single();
    if (regError || !reg) return json({ error: 'Registration not found' }, 404);
    if (reg.status !== 'pending') return json({ error: `Registration is already ${reg.status}` }, 400);

    const reviewStamp = { reviewed_by: caller.id, reviewed_at: new Date().toISOString() };

    if (action === 'reject') {
      const { error } = await admin.from('caregiver_registrations')
        .update({ status: 'rejected', rejection_reason: rejectionReason, ...reviewStamp })
        .eq('id', registrationId);
      if (error) return json({ error: error.message }, 400);

      await admin.from('pending_notifications').insert({
        agency_id: agencyId,
        recipient_email: reg.email,
        recipient_name: `${reg.first_name} ${reg.last_name}`,
        kind: 'caregiver_rejected',
        subject: 'Your caregiver application was not approved',
        body: `Hi ${reg.first_name}, unfortunately your application was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        payload: { registration_id: registrationId, rejection_reason: rejectionReason },
      });

      return json({ success: true, status: 'rejected' });
    }

    // Approve: find the auth user created at self-registration
    let authUserId: string | null = null;
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = usersPage?.users?.find(
      (u) => (u.email ?? '').toLowerCase() === reg.email.toLowerCase()
    );
    if (match) authUserId = match.id;

    let tempPassword: string | null = null;
    if (!authUserId) {
      tempPassword = `Care-${crypto.randomUUID().slice(0, 10)}`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: reg.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: `${reg.first_name} ${reg.last_name}`,
          agency_id: agencyId,
        },
      });
      if (createError || !created.user) return json({ error: createError?.message ?? 'Failed to create account' }, 400);
      authUserId = created.user.id;
      await new Promise((r) => setTimeout(r, 400));
    }

    // Make sure the profile exists and is attached to this agency
    await admin.from('profiles').upsert({
      id: authUserId,
      email: reg.email,
      full_name: `${reg.first_name} ${reg.last_name}`,
      phone: reg.phone,
      agency_id: agencyId,
    }, { onConflict: 'id' });

    // Link or create the caregiver roster record
    const { data: existing } = await admin
      .from('caregivers').select('id, user_id').eq('agency_id', agencyId).ilike('email', reg.email).maybeSingle();

    let caregiverId: string;
    if (existing) {
      caregiverId = existing.id;
      await admin.from('caregivers').update({ user_id: authUserId, is_active: true }).eq('id', existing.id);
    } else {
      const { data: inserted, error: insertError } = await admin.from('caregivers').insert({
        agency_id: agencyId,
        user_id: authUserId,
        first_name: reg.first_name,
        last_name: reg.last_name,
        email: reg.email,
        phone: reg.phone,
        address: reg.address,
        city: reg.city,
        state: reg.state,
        zip_code: reg.zip_code,
        employment_type: reg.employment_type ?? 'full_time',
        hourly_rate: reg.hourly_rate,
        is_active: true,
      }).select('id').single();
      if (insertError || !inserted) return json({ error: insertError?.message ?? 'Failed to create caregiver' }, 400);
      caregiverId = inserted.id;
    }

    // Grant the caregiver role
    await admin.from('user_roles')
      .upsert({ user_id: authUserId, role: 'caregiver', agency_id: agencyId }, { onConflict: 'user_id,role' });

    const { error: updateError } = await admin.from('caregiver_registrations')
      .update({ status: 'approved', agency_id: agencyId, ...reviewStamp })
      .eq('id', registrationId);
    if (updateError) return json({ error: updateError.message }, 400);

    await admin.from('pending_notifications').insert({
      agency_id: agencyId,
      recipient_email: reg.email,
      recipient_name: `${reg.first_name} ${reg.last_name}`,
      kind: 'caregiver_approved',
      subject: 'Your caregiver account is active',
      body: `Hi ${reg.first_name}, your application was approved. You can now sign in${tempPassword ? ` with the temporary password: ${tempPassword}` : ' with the password you chose during registration'}.`,
      payload: { registration_id: registrationId, caregiver_id: caregiverId, temp_password: tempPassword },
    });

    return json({ success: true, status: 'approved', caregiverId, userId: authUserId, tempPassword });
  } catch (error) {
    console.error('approve-caregiver-registration error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
