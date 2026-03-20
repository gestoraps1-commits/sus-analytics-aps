import { Client } from "npm:pg@8.16.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type UploadMode = "citizen" | "professional";
type SearchSource = "cpf" | "cns" | "nome_data_nascimento" | "nome" | "data_nascimento" | null;

type InputRow = {
  index: number;
  cpf?: string;
  cns?: string;
  nome?: string;
  nascimento?: string;
  profissional?: string;
  unidade?: string;
  acs?: string;
};

type CitizenMatch = {
  cpfBase: string | null;
  cnsBase: string | null;
  nomeBase: string | null;
  unidadeBase: string | null;
  telefoneBase: string | null;
  sexoBase: string | null;
  nascimentoBase: string | null;
  equipeBase: string | null;
};

type ProfessionalMatch = {
  cnsBase: string | null;
  profissionalBase: string | null;
  unidadeBase: string | null;
};

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const normalizeName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const normalizeDateValue = (value: unknown) => {
  const input = String(value ?? "").trim();
  if (!input) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const slashMatch = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
};

const getMatchId = (match: CitizenMatch) =>
  [match.cpfBase ?? "", match.cnsBase ?? "", match.nomeBase ?? "", match.nascimentoBase ?? ""].join("|");

const upsertUnique = (map: Map<string, CitizenMatch | "AMBIGUOUS">, key: string, match: CitizenMatch) => {
  if (!key) return;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, match);
    return;
  }

  if (existing !== "AMBIGUOUS" && getMatchId(existing) !== getMatchId(match)) {
    map.set(key, "AMBIGUOUS");
  }
};

const getUnique = (match: CitizenMatch | "AMBIGUOUS" | undefined) => {
  if (!match || match === "AMBIGUOUS") return null;
  return match;
};

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

  const body = await req.json().catch(() => null);
  const mode = body?.mode as UploadMode | undefined;
  const rows = Array.isArray(body?.rows) ? (body.rows as InputRow[]) : [];
  const cachedResults = body?.cachedResults && typeof body.cachedResults === "object"
    ? (body.cachedResults as Record<string, { found?: boolean; source?: SearchSource; backend?: CitizenMatch | ProfessionalMatch | null }>)
    : null;

  if (!mode || !["citizen", "professional"].includes(mode) || rows.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "Payload inválido para busca de referência." }), {
      status: 400,
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
    await client.connect();

    if (mode === "professional") {
      const cnsList = [...new Set(rows.map((row) => normalizeDigits(row.cns)).filter(Boolean))];
      const professionalMap = new Map<string, ProfessionalMatch>();

      if (cnsList.length > 0) {
        const result = await client.query(
          `
            select
              regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') as normalized_cns,
              p.nu_cns as cns_base,
              p.no_profissional as profissional_base,
              coalesce(max(u.no_unidade_saude), '') as unidade_base
            from public.tb_dim_profissional p
            left join public.tb_fat_cad_individual f on f.co_dim_profissional = p.co_seq_dim_profissional
            left join public.tb_dim_unidade_saude u on u.co_seq_dim_unidade_saude = f.co_dim_unidade_saude
            where regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') = any($1::text[])
            group by p.nu_cns, p.no_profissional
          `,
          [cnsList],
        );

        for (const row of result.rows) {
          professionalMap.set(row.normalized_cns, {
            cnsBase: row.cns_base,
            profissionalBase: row.profissional_base,
            unidadeBase: row.unidade_base,
          });
        }
      }

      const mappedResults = rows.map((row) => {
        const cns = normalizeDigits(row.cns);
        const backend = professionalMap.get(cns) ?? null;
        return {
          index: row.index,
          found: Boolean(backend),
          source: backend ? "cns" : null,
          backend,
        };
      });

      const changedResults = mappedResults.filter((result) => {
        const cached = cachedResults?.[String(result.index)];
        if (!cachedResults || !cached) return true;
        return JSON.stringify({ found: Boolean(cached.found), source: cached.source ?? null, backend: cached.backend ?? null }) !== JSON.stringify(result);
      });

      return new Response(
        JSON.stringify({
          success: true,
          results: cachedResults ? changedResults : mappedResults,
          incremental: Boolean(cachedResults),
          changedCount: changedResults.length,
          unchangedCount: mappedResults.length - changedResults.length,
          totalRows: mappedResults.length,
          refreshedAt: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cpfList = [...new Set(rows.map((row) => normalizeDigits(row.cpf)).filter(Boolean))];
    const cnsList = [...new Set(rows.map((row) => normalizeDigits(row.cns)).filter(Boolean))];
    const nomeList = [...new Set(rows.map((row) => normalizeName(row.nome)).filter(Boolean))];
    const nascimentoList = [...new Set(rows.map((row) => normalizeDateValue(row.nascimento)).filter(Boolean))];

    const cpfMap = new Map<string, CitizenMatch>();
    const cnsMap = new Map<string, CitizenMatch>();
    const nomeDataMap = new Map<string, CitizenMatch>();
    const nomeMap = new Map<string, CitizenMatch | "AMBIGUOUS">();
    const nascimentoMap = new Map<string, CitizenMatch | "AMBIGUOUS">();

    const mapCitizenRow = (row: Record<string, string | null>) => ({
      cpfBase: row.cpf_base,
      cnsBase: row.cns_base,
      nomeBase: row.nome_base,
      unidadeBase: row.unidade_base,
      telefoneBase: row.telefone_base,
      sexoBase: row.sexo_base,
      nascimentoBase: row.nascimento_base,
      equipeBase: row.equipe_base,
    });

    const citizenBaseQuery = `
      select distinct on (p.co_seq_fat_cidadao_pec)
        regexp_replace(coalesce(p.nu_cpf_cidadao, ''), '\\D', '', 'g') as normalized_cpf,
        regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') as normalized_cns,
        p.nu_cpf_cidadao as cpf_base,
        p.nu_cns as cns_base,
        upper(regexp_replace(trim(coalesce(p.no_cidadao, c.no_cidadao, '')), '\\s+', ' ', 'g')) as normalized_name,
        coalesce(p.no_cidadao, c.no_cidadao) as nome_base,
        coalesce(u.no_unidade_saude, '') as unidade_base,
        coalesce(c.nu_telefone_celular, p.nu_telefone_celular, '') as telefone_base,
        c.no_sexo as sexo_base,
        c.dt_nascimento::text as nascimento_base,
        coalesce(a.no_equipe_vinc_equipe, '') as equipe_base
      from public.tb_fat_cidadao_pec p
      left join public.tb_cidadao c on c.co_seq_cidadao = p.co_cidadao
      left join public.tb_dim_unidade_saude u on u.co_seq_dim_unidade_saude = p.co_dim_unidade_saude_vinc
      left join public.tb_acomp_cidadaos_vinculados a on a.co_fat_cidadao_pec = p.co_seq_fat_cidadao_pec
      where %FILTER%
    `;

    if (cpfList.length > 0) {
      const result = await client.query(
        citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cpf_cidadao, ''), '\\D', '', 'g') = any($1::text[])"),
        [cpfList],
      );

      for (const row of result.rows) {
        cpfMap.set(row.normalized_cpf, mapCitizenRow(row));
      }
    }

    if (cnsList.length > 0) {
      const result = await client.query(
        citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') = any($1::text[])"),
        [cnsList],
      );

      for (const row of result.rows) {
        cnsMap.set(row.normalized_cns, mapCitizenRow(row));
      }
    }

    if (nomeList.length > 0 || nascimentoList.length > 0) {
      const conditions: string[] = [];
      const params: Array<string[]> = [];
      let parameterIndex = 1;

      if (nomeList.length > 0) {
        conditions.push(`upper(regexp_replace(trim(coalesce(p.no_cidadao, c.no_cidadao, '')), '\\s+', ' ', 'g')) = any($${parameterIndex}::text[])`);
        params.push(nomeList);
        parameterIndex += 1;
      }

      if (nascimentoList.length > 0) {
        conditions.push(`c.dt_nascimento::text = any($${parameterIndex}::text[])`);
        params.push(nascimentoList);
      }

      const result = await client.query(citizenBaseQuery.replace("%FILTER%", conditions.join(" or ")), params);

      for (const row of result.rows) {
        const match = mapCitizenRow(row);
        const normalizedName = row.normalized_name ? String(row.normalized_name) : "";
        const normalizedBirth = normalizeDateValue(row.nascimento_base);

        if (normalizedName && normalizedBirth) {
          upsertUnique(nomeDataMap as unknown as Map<string, CitizenMatch | "AMBIGUOUS">, `${normalizedName}|${normalizedBirth}`, match);
        }

        upsertUnique(nomeMap, normalizedName, match);
        upsertUnique(nascimentoMap, normalizedBirth, match);
      }
    }

    const mappedResults = rows.map((row) => {
      const cpf = normalizeDigits(row.cpf);
      const cns = normalizeDigits(row.cns);
      const nome = normalizeName(row.nome);
      const nascimento = normalizeDateValue(row.nascimento);

      const byCpf = cpf ? cpfMap.get(cpf) ?? null : null;
      const byCns = cns ? cnsMap.get(cns) ?? null : null;
      const byNomeData = nome && nascimento ? getUnique((nomeDataMap as unknown as Map<string, CitizenMatch | "AMBIGUOUS">).get(`${nome}|${nascimento}`)) : null;
      const byNome = nome ? getUnique(nomeMap.get(nome)) : null;
      const byNascimento = nascimento ? getUnique(nascimentoMap.get(nascimento)) : null;

      const backend = byCpf ?? byCns ?? byNomeData ?? byNome ?? byNascimento ?? null;
      const source: SearchSource = byCpf
        ? "cpf"
        : byCns
          ? "cns"
          : byNomeData
            ? "nome_data_nascimento"
            : byNome
              ? "nome"
              : byNascimento
                ? "data_nascimento"
                : null;

      return {
        index: row.index,
        found: Boolean(backend),
        source,
        backend,
      };
    });

    const changedResults = mappedResults.filter((result) => {
      const cached = cachedResults?.[String(result.index)];
      if (!cachedResults || !cached) return true;
      return JSON.stringify({ found: Boolean(cached.found), source: cached.source ?? null, backend: cached.backend ?? null }) !== JSON.stringify(result);
    });

    return new Response(
      JSON.stringify({
        success: true,
        results: cachedResults ? changedResults : mappedResults,
        incremental: Boolean(cachedResults),
        changedCount: changedResults.length,
        unchangedCount: mappedResults.length - changedResults.length,
        totalRows: mappedResults.length,
        refreshedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Falha ao buscar dados de referência.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
});

