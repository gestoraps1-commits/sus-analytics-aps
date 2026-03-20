import { Client } from "npm:pg@8.16.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Procedure codes grouped by indicator.
 */
const INDICATOR_CODES: Record<string, string[]> = {
  c1: [], // C1 uses consultations only, no specific procedure codes
  c2: [
    "9", "17", "29", "39", "42", "43", "46", "47", "58",
    "22", "24", "56", "26", "59", "106", "107",
    "0101040024", "0301010269", "0101040083", "0101040075",
  ],
  c3: [
    "0301010030", "0301010064", "0301010110", "0301010129", "0301010250",
    "0301100039", "0101040024", "0101040083", "0101040075",
    "57",
    "0214010074", "0214010082", "0214010252", "0202031098", "0202031110", "0202031179",
    "0202010473", "0202010317",
  ],
  c4: [
    "0301100039", "0101040024", "0101040083", "0101040075",
    "0202010503", "ABEX008",
    "0301040095", "ABPG011",
    "0301010110", "0301010129",
  ],
  c5: [
    "0301100039", "0101040024", "0101040083", "0101040075",
    "0205020097", "0202010317",
    "0301010110", "0301010129",
  ],
  c6: [
    "0301010030", "0301010064", "0301010250",
    "0101040024", "0101040083", "0101040075",
    "33", "77",
  ],
  c7: [
    "0201020033", "0203010086", "0203010019", "0201020076", "0201020084",
    "0204030030", "0204030188",
    "67", "93",
    "ABP003", "ABP022", "ABP023",
  ],
};

const ALL_CODES = [...new Set(Object.values(INDICATOR_CODES).flat())];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const host = Deno.env.get("EXTERNAL_DB_HOST");
  const port = Number(Deno.env.get("EXTERNAL_DB_PORT") || "5432");
  const database = Deno.env.get("EXTERNAL_DB_NAME");
  const user = Deno.env.get("EXTERNAL_DB_USER");
  const password = Deno.env.get("EXTERNAL_DB_PASSWORD");

  if (!host || !database || !user || !password) {
    return new Response(JSON.stringify({ success: false, error: "Credenciais do banco não configuradas." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const dateFrom: string | null = body.dateFrom ?? null;
  const dateTo: string | null = body.dateTo ?? null;
  const unitFilter: string | null = body.unit ?? null;
  const professionalFilter: string | null = body.professional ?? null;
  const indicatorFilter: string | null = body.indicator ?? null; // e.g. "c2", "c3", ...
  const limitRows: number = Math.min(Number(body.limit) || 2000, 10000);

  // Determine which codes to filter
  const activeCodes = indicatorFilter && INDICATOR_CODES[indicatorFilter]
    ? INDICATOR_CODES[indicatorFilter]
    : ALL_CODES;
  const activeCodesSet = new Set(activeCodes);

  const client = new Client({ host, port, database, user, password, ssl: false, connectionTimeoutMillis: 10000, query_timeout: 30000, statement_timeout: 30000 });

  try {
    await client.connect();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dateFrom) { conditions.push(`t.dt_registro >= $${idx}::date`); params.push(dateFrom); idx++; }
    if (dateTo) { conditions.push(`t.dt_registro <= $${idx}::date`); params.push(dateTo); idx++; }
    if (unitFilter) { conditions.push(`u.no_unidade_saude = $${idx}`); params.push(unitFilter); idx++; }
    if (professionalFilter) {
      conditions.push(`(prof1.no_profissional = $${idx} OR prof2.no_profissional = $${idx})`);
      params.push(professionalFilter); idx++;
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    const proceduresQuery = `
      SELECT
        t.dt_registro::text AS event_date,
        prof1.no_profissional AS professional1,
        prof2.no_profissional AS professional2,
        pa.co_proced AS proc_code_a,
        pa.ds_proced AS proc_desc_a,
        ps.co_proced AS proc_code_s,
        ps.ds_proced AS proc_desc_s,
        u.no_unidade_saude AS unidade,
        cid.no_cidadao AS paciente
      FROM public.tb_fat_atd_ind_procedimentos p
      JOIN public.tb_dim_tempo t ON t.co_seq_dim_tempo = p.co_dim_tempo
      LEFT JOIN public.tb_dim_procedimento pa ON pa.co_seq_dim_procedimento = p.co_dim_procedimento_avaliado
      LEFT JOIN public.tb_dim_procedimento ps ON ps.co_seq_dim_procedimento = p.co_dim_procedimento_solicitado
      LEFT JOIN public.tb_dim_profissional prof1 ON prof1.co_seq_dim_profissional = p.co_dim_profissional_1
      LEFT JOIN public.tb_dim_profissional prof2 ON prof2.co_seq_dim_profissional = p.co_dim_profissional_2
      LEFT JOIN public.tb_fat_cidadao_pec fp ON fp.co_seq_fat_cidadao_pec = p.co_fat_cidadao_pec
      LEFT JOIN public.tb_cidadao cid ON cid.co_seq_cidadao = fp.co_cidadao
      LEFT JOIN public.tb_dim_unidade_saude u ON u.co_seq_dim_unidade_saude = p.co_dim_unidade_saude_1
      WHERE 1=1 ${whereClause}
      ORDER BY t.dt_registro DESC
      LIMIT ${limitRows}
    `;

    // Run all queries in PARALLEL for performance
    const includeConsultations = !indicatorFilter || !["c2", "c7"].includes(indicatorFilter);
    const includeVisits = !indicatorFilter || !["c2", "c7"].includes(indicatorFilter);

    const consultationsQuery = `
      SELECT
        t.dt_registro::text AS event_date,
        prof1.no_profissional AS professional1,
        prof2.no_profissional AS professional2,
        u.no_unidade_saude AS unidade,
        cid.no_cidadao AS paciente,
        cbo1.nu_cbo AS cbo1,
        cbo2.nu_cbo AS cbo2
      FROM public.tb_fat_atendimento_individual ai
      JOIN public.tb_dim_tempo t ON t.co_seq_dim_tempo = ai.co_dim_tempo
      LEFT JOIN public.tb_dim_profissional prof1 ON prof1.co_seq_dim_profissional = ai.co_dim_profissional_1
      LEFT JOIN public.tb_dim_profissional prof2 ON prof2.co_seq_dim_profissional = ai.co_dim_profissional_2
      LEFT JOIN public.tb_dim_cbo cbo1 ON cbo1.co_seq_dim_cbo = ai.co_dim_cbo_1
      LEFT JOIN public.tb_dim_cbo cbo2 ON cbo2.co_seq_dim_cbo = ai.co_dim_cbo_2
      LEFT JOIN public.tb_fat_cidadao_pec fp ON fp.co_seq_fat_cidadao_pec = ai.co_fat_cidadao_pec
      LEFT JOIN public.tb_cidadao cid ON cid.co_seq_cidadao = fp.co_cidadao
      LEFT JOIN public.tb_dim_unidade_saude u ON u.co_seq_dim_unidade_saude = ai.co_dim_unidade_saude_1
      WHERE 1=1 ${whereClause}
      ORDER BY t.dt_registro DESC
      LIMIT ${limitRows}
    `;

    const visitsQuery = `
      SELECT
        t.dt_registro::text AS event_date,
        prof.no_profissional AS professional1,
        NULL AS professional2,
        u.no_unidade_saude AS unidade,
        cid.no_cidadao AS paciente
      FROM public.tb_fat_visita_domiciliar v
      JOIN public.tb_dim_tempo t ON t.co_seq_dim_tempo = v.co_dim_tempo
      LEFT JOIN public.tb_dim_profissional prof ON prof.co_seq_dim_profissional = v.co_dim_profissional
      LEFT JOIN public.tb_fat_cidadao_pec fp ON fp.co_seq_fat_cidadao_pec = v.co_fat_cidadao_pec
      LEFT JOIN public.tb_cidadao cid ON cid.co_seq_cidadao = fp.co_cidadao
      LEFT JOIN public.tb_dim_unidade_saude u ON u.co_seq_dim_unidade_saude = v.co_dim_unidade_saude
      WHERE 1=1 ${whereClause}
      ORDER BY t.dt_registro DESC
      LIMIT ${limitRows}
    `;

    const [proceduresResult, consultationsResult, visitsResult] = await Promise.all([
      client.query(proceduresQuery, params),
      includeConsultations ? client.query(consultationsQuery, params) : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      includeVisits ? client.query(visitsQuery, params) : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);

    const unitsSet = new Set<string>();
    const professionalsSet = new Set<string>();

    type AuditRecord = {
      date: string;
      professional: string;
      procedure: string;
      unit: string;
      patient: string;
      source: string;
      indicator: string;
    };

    const records: AuditRecord[] = [];
    const normName = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim();
    const isNamed = (v: string | null) => {
      const n = normName(v);
      if (!n) return false;
      return n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() !== "NAO INFORMADO";
    };

    const getIndicatorForCode = (code: string): string => {
      const matches: string[] = [];
      for (const [key, codes] of Object.entries(INDICATOR_CODES)) {
        if (codes.includes(code)) matches.push(key.toUpperCase());
      }
      return matches.length > 0 ? matches.join(", ") : "-";
    };

    const addRecord = (date: string, prof: string, procedure: string, unit: string, patient: string, source: string, indicator: string) => {
      const u = normName(unit);
      const p = normName(prof);
      if (u) unitsSet.add(u);
      if (p && isNamed(p)) professionalsSet.add(p);
      records.push({ date: (date ?? "").slice(0, 10), professional: p, procedure, unit: u, patient: normName(patient), source, indicator });
    };

    for (const row of proceduresResult.rows) {
      const procCodeA = String(row.proc_code_a ?? "").trim();
      const procCodeS = String(row.proc_code_s ?? "").trim();
      const isRelevantA = activeCodesSet.has(procCodeA);
      const isRelevantS = activeCodesSet.has(procCodeS);

      if (!isRelevantA && !isRelevantS) continue;

      const matchedCode = isRelevantA ? procCodeA : procCodeS;
      const procLabel = isRelevantA
        ? (row.proc_desc_a ?? procCodeA)
        : (row.proc_desc_s ?? procCodeS);
      const indicatorLabel = getIndicatorForCode(matchedCode);

      const profs = [row.professional1, row.professional2].filter(isNamed);
      for (const prof of profs) {
        addRecord(row.event_date, prof, procLabel, row.unidade, row.paciente, "Procedimento", indicatorLabel);
      }
      if (profs.length === 0) {
        addRecord(row.event_date, "", procLabel, row.unidade, row.paciente, "Procedimento", indicatorLabel);
      }
    }

    for (const row of consultationsResult.rows) {
      const profs = [row.professional1 as string, row.professional2 as string].filter(isNamed);
      const ind = indicatorFilter ? indicatorFilter.toUpperCase() : "C3, C4, C5, C6";
      for (const prof of profs) {
        addRecord(row.event_date as string, prof, "Consulta Individual", row.unidade as string, row.paciente as string, "Atendimento", ind);
      }
      if (profs.length === 0) {
        addRecord(row.event_date as string, "", "Consulta Individual", row.unidade as string, row.paciente as string, "Atendimento", ind);
      }
    }

    for (const row of visitsResult.rows) {
      const prof = isNamed(row.professional1 as string) ? normName(row.professional1 as string) : "";
      const ind = indicatorFilter ? indicatorFilter.toUpperCase() : "C3, C4, C5, C6";
      addRecord(row.event_date as string, prof, "Visita Domiciliar", row.unidade as string, row.paciente as string, "Visita", ind);
    }

    records.sort((a, b) => b.date.localeCompare(a.date) || a.professional.localeCompare(b.professional, "pt-BR"));

    return new Response(JSON.stringify({
      success: true,
      records,
      filters: {
        units: [...unitsSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
        professionals: [...professionalsSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
      },
      total: records.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: "Falha ao buscar dados de auditoria.",
      hint: error instanceof Error ? error.message : "Erro desconhecido",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
