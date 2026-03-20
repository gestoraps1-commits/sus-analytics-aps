import { Client } from "npm:pg@8.16.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type KpiRow = {
  label: string;
  value: string;
  helper: string;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth guard: require authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const host = Deno.env.get("EXTERNAL_DB_HOST");
  const port = Number(Deno.env.get("EXTERNAL_DB_PORT") || "5432");
  const database = Deno.env.get("EXTERNAL_DB_NAME");
  const user = Deno.env.get("EXTERNAL_DB_USER");
  const password = Deno.env.get("EXTERNAL_DB_PASSWORD");

  if (!host || !database || !user || !password) {
    return new Response(JSON.stringify({ success: false, error: "Credenciais do banco não configuradas no backend." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log(`[test-remote-db] Connecting to ${host}:${port}/${database} as ${user}...`);
    await client.connect();
    console.log("[test-remote-db] Connected successfully!");

    const summaryResult = await client.query(`
      select
        now() as server_time,
        pg_database_size(current_database()) as database_size,
        (select count(*) from information_schema.tables where table_schema = 'public') as total_tables,
        (select count(*) from information_schema.views where table_schema = 'public') as total_views,
        (select coalesce(sum(n_live_tup), 0)::bigint from pg_stat_user_tables where schemaname = 'public') as estimated_rows,
        (select coalesce(sum(pg_total_relation_size(format('%I.%I', schemaname, relname))), 0)::bigint from pg_stat_user_tables where schemaname = 'public') as total_table_size
    `);

    const topTablesResult = await client.query(`
      select
        schemaname,
        relname,
        coalesce(n_live_tup, 0)::bigint as estimated_rows,
        pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname))) as total_size
      from pg_stat_user_tables
      where schemaname = 'public'
      order by n_live_tup desc nulls last, relname asc
      limit 5
    `);

    const info = summaryResult.rows[0];

    const kpis: KpiRow[] = [
      {
        label: "Tabelas",
        value: String(info.total_tables ?? 0),
        helper: "Estruturas encontradas no banco",
      },
      {
        label: "Views",
        value: String(info.total_views ?? 0),
        helper: "Consultas materializadas/lógicas disponíveis",
      },
      {
        label: "Linhas estimadas",
        value: new Intl.NumberFormat("pt-BR").format(Number(info.estimated_rows ?? 0)),
        helper: "Soma aproximada das tabelas do usuário",
      },
      {
        label: "Tamanho do banco",
        value: formatBytes(Number(info.database_size ?? 0)),
        helper: "Espaço total ocupado atualmente",
      },
    ];

    return new Response(JSON.stringify({
      success: true,
      message: "Conexão realizada com sucesso.",
      connection: {
        host,
        port,
        database,
        user,
        serverTime: info.server_time,
      },
      kpis,
      topTables: topTablesResult.rows.map((table) => ({
        schema: table.schemaname,
        name: table.relname,
        estimatedRows: Number(table.estimated_rows ?? 0),
        totalSize: table.total_size,
      })),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[test-remote-db] Error:", error?.message || error);
    console.error("[test-remote-db] Stack:", error?.stack);
    return new Response(JSON.stringify({
      success: false,
      error: "Falha ao conectar no banco de dados.",
      detail: error?.message || String(error),
      hint: "Verifique host, porta, whitelist/firewall e se o banco aceita conexões remotas.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
});
