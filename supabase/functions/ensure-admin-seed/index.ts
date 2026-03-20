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
    // Auth guard: require a secret token or service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Only allow calls authenticated with the service role key
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    // Read credentials from environment secrets — never hardcode
    const ADMIN_EMAIL = Deno.env.get("ADMIN_SEED_EMAIL") || "admin@aps.com";
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_SEED_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: false, error: "ADMIN_SEED_PASSWORD secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if admin exists in auth
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const adminAuth = listData?.users?.find((u: any) => u.email === ADMIN_EMAIL);

    let authUserId: string;

    if (!adminAuth) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createError) throw createError;
      authUserId = newUser.user.id;
    } else {
      authUserId = adminAuth.id;
    }

    // Check if app_users record exists
    const { data: existingAppUser } = await supabaseAdmin
      .from("app_users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!existingAppUser) {
      const { error: insertError } = await supabaseAdmin
        .from("app_users")
        .insert({
          auth_user_id: authUserId,
          nome_completo: "Administrador Master",
          email: ADMIN_EMAIL,
          status: "aprovado",
          acesso: true,
          is_master_admin: true,
          precisa_trocar_senha: false,
        });
      if (insertError) throw insertError;
    }

    // Ensure admin role in user_roles table
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", authUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({ user_id: authUserId, role: "admin" });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
