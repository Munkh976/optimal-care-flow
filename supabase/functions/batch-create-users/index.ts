import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const defaultPassword = "123456";
    const agencyId = "56fbfe38-e8eb-40c1-ba27-07428f62ed2e";
    const preservedEmails = ["munkh.mn@gmail.com"];
    
    const results = {
      deleted: 0,
      clients: [] as any[],
      caregivers: [] as any[],
      errors: [] as any[],
    };

    // Get all auth users
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    // Identify system_admin and preserved accounts
    const preservedUserIds: string[] = [];
    for (const user of allUsers || []) {
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      if (roleData?.role === "system_admin" || preservedEmails.includes(user.email || "")) {
        preservedUserIds.push(user.id);
      }
    }

    // Delete all users except preserved ones
    for (const user of allUsers || []) {
      if (!preservedUserIds.includes(user.id)) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
          results.deleted++;
        } catch (error) {
          console.error(`Failed to delete user ${user.email}:`, error);
        }
      }
    }

    // Reset user_id in clients and caregivers tables
    await supabaseAdmin.from("clients").update({ user_id: null }).neq("user_id", null);
    await supabaseAdmin.from("caregivers").update({ user_id: null }).neq("user_id", null);

    // Fetch all clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select("*");

    if (clientsError) throw clientsError;

    // Create users for clients
    for (const client of clients || []) {
      try {
        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: `${client.first_name} ${client.last_name}`,
          },
        });

        if (authError) throw authError;

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: authUser.user.id,
            email: client.email,
            full_name: `${client.first_name} ${client.last_name}`,
            phone: client.phone,
            agency_id: agencyId,
          });

        if (profileError) throw profileError;

        // Update client with user_id
        const { error: updateError } = await supabaseAdmin
          .from("clients")
          .update({ user_id: authUser.user.id })
          .eq("id", client.id);

        if (updateError) throw updateError;

        // Create user role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: authUser.user.id,
            role: "client",
            agency_id: agencyId,
          });

        if (roleError) throw roleError;

        results.clients.push({
          email: client.email,
          name: `${client.first_name} ${client.last_name}`,
          userId: authUser.user.id,
        });
      } catch (error) {
        results.errors.push({
          type: "client",
          email: client.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fetch all caregivers
    const { data: caregivers, error: caregiversError } = await supabaseAdmin
      .from("caregivers")
      .select("*");

    if (caregiversError) throw caregiversError;

    // Create users for caregivers
    for (const caregiver of caregivers || []) {
      try {
        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: caregiver.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: `${caregiver.first_name} ${caregiver.last_name}`,
          },
        });

        if (authError) throw authError;

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: authUser.user.id,
            email: caregiver.email,
            full_name: `${caregiver.first_name} ${caregiver.last_name}`,
            phone: caregiver.phone,
            agency_id: agencyId,
          });

        if (profileError) throw profileError;

        // Update caregiver with user_id
        const { error: updateError } = await supabaseAdmin
          .from("caregivers")
          .update({ user_id: authUser.user.id })
          .eq("id", caregiver.id);

        if (updateError) throw updateError;

        // Create user role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: authUser.user.id,
            role: "caregiver",
            agency_id: agencyId,
          });

        if (roleError) throw roleError;

        results.caregivers.push({
          email: caregiver.email,
          name: `${caregiver.first_name} ${caregiver.last_name}`,
          userId: authUser.user.id,
        });
      } catch (error) {
        results.errors.push({
          type: "caregiver",
          email: caregiver.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${results.deleted} users. Created ${results.clients.length} client users and ${results.caregivers.length} caregiver users`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
