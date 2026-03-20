import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const callerId = claimsData.claims.sub;

    // Check if caller is admin
    const { data: callerUser } = await supabaseAdmin
      .from("app_users")
      .select("is_master_admin")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    if (!callerUser?.is_master_admin) {
      const { data: hasAdminRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();
      if (!hasAdminRole) {
        return new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ success: false, error: "target_user_id required" }), { status: 400, headers: corsHeaders });
    }

    // Generate a random temporary password instead of hardcoded one
    const tempPassword = crypto.randomUUID().slice(0, 8) + "A1!";

    // Reset password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
      password: tempPassword,
    });
    if (updateError) throw updateError;

    // Set flag
    await supabaseAdmin
      .from("app_users")
      .update({ precisa_trocar_senha: true })
      .eq("auth_user_id", target_user_id);

    return new Response(JSON.stringify({ success: true, temp_password: tempPassword }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
