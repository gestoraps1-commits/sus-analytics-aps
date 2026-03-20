import { Client } from "npm:pg@8.16.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IndicatorFlagKey = "A" | "B" | "C" | "D";
type IndicatorFlagStatus = "done" | "attention" | "tracking";
type ParsedRow = Record<string, string>;

type PatientInput = {
  index: number;
  cpf?: string;
  cns?: string;
  nome?: string;
  nascimento?: string;
  sexo?: string;
  unidade?: string;
  equipe?: string;
  sourceRow?: ParsedRow;
};

type CitizenMatch = {
  citizenId: number;
  cpf: string | null;
  cns: string | null;
  nome: string | null;
  nascimento: string | null;
  sexo: string | null;
  unidade: string | null;
  equipe: string | null;
};

type AttendanceRow = {
  citizen_id: number;
  event_date: string;
  cbo1?: string | null;
  cbo2?: string | null;
  professional1?: string | null;
  professional2?: string | null;
  weight?: number | null;
  height?: number | null;
};

type ProcedureRow = {
  citizen_id: number;
  event_date: string;
  cbo1?: string | null;
  cbo2?: string | null;
  proc_a?: string | null;
  proc_s?: string | null;
  professional1?: string | null;
  professional2?: string | null;
};

type VisitRow = {
  citizen_id: number;
  event_date: string;
  cbo?: string | null;
  professional?: string | null;
  weight?: number | null;
  height?: number | null;
  chronic_followup?: number | null;
};

type VaccineRow = {
  citizen_id: number;
  event_date: string;
  vaccine_code: string | null;
  professional?: string | null;
};

type IndicatorProcedureEvent = {
  date: string;
  professional: string;
};

type AnthropometryRecord = {
  date: string;
  weight: number | null;
  height: number | null;
};

type IndicatorFlagDeadline = {
  date: string;
  label: string;
};

type IndicatorFlag = {
  key: IndicatorFlagKey;
  title: string;
  status: IndicatorFlagStatus;
  completed: boolean;
  points: number;
  earnedPoints: number;
  metric: string;
  summary: string;
  detail: string;
  deadline?: IndicatorFlagDeadline | null;
  events?: IndicatorProcedureEvent[];
};

type IndicatorPatient = {
  index: number;
  nome: string;
  cpf: string;
  cns: string;
  nascimento: string;
  sexo: string;
  unidade: string;
  equipe: string;
  idadeEmMeses: number;
  totalPoints: number;
  classification: "regular" | "suficiente" | "bom" | "otimo";
  completedFlags: number;
  pendingFlags: number;
  trackingFlags: number;
  flags: IndicatorFlag[];
  anthropometryRecords?: AnthropometryRecord[];
};

const FLAG_POINTS: Record<IndicatorFlagKey, number> = {
  A: 25,
  B: 25,
  C: 25,
  D: 25,
};

const MEDICAL_NURSE_CBO_PREFIXES = ["2231", "2235", "2251", "2252", "2253"];
const GENERAL_PROCEDURE_CBO_PREFIXES = ["2231", "2232", "2234", "2235", "2236", "2237", "2238", "2239", "2241", "2251", "2252", "2253", "3222", "3224"];
const ACS_CBO_CODES = ["515105", "322255"];
const ANTHROPOMETRY_CODE = "0101040024";
const WEIGHT_CODE = "0101040083";
const HEIGHT_CODE = "0101040075";
const CONSULTATION_CODES = ["0301010030", "0301010064", "0301010250"];
const INFLUENZA_CODES = ["33", "77"];

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizeCode = (value: unknown) => String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const normalizeName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
const normalizeLabel = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 ]/g, "")
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
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const isValidDateValue = (value: string | null | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime()));
const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};
const diffInDays = (start: Date, end: Date) => Math.floor((end.getTime() - start.getTime()) / 86400000);
const diffInMonths = (start: Date, end: Date) => Math.max(0, Math.floor(diffInDays(start, end) / 30.4375));
const getClassification = (points: number): IndicatorPatient["classification"] => {
  if (points > 75) return "otimo";
  if (points > 50) return "bom";
  if (points > 25) return "suficiente";
  return "regular";
};
const normalizeProfessional = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();
const isNamedProfessional = (value: string | null | undefined) => {
  const professional = normalizeProfessional(value);
  if (!professional) return false;
  return normalizeLabel(professional) !== "NAO INFORMADO";
};
const normalizeCbo = (value: string | null | undefined) => normalizeDigits(value);
const startsWithAny = (value: string, prefixes: string[]) => prefixes.some((prefix) => value.startsWith(prefix));
const isMedicalNurseCbo = (value: string | null | undefined) => startsWithAny(normalizeCbo(value), MEDICAL_NURSE_CBO_PREFIXES);
const isGeneralProcedureCbo = (value: string | null | undefined) => startsWithAny(normalizeCbo(value), GENERAL_PROCEDURE_CBO_PREFIXES) || ACS_CBO_CODES.includes(normalizeCbo(value));
const isAcsCbo = (value: string | null | undefined) => ACS_CBO_CODES.includes(normalizeCbo(value));
const buildQualifiedEvents = (date: string, pairs: Array<{ professional: string | null | undefined; eligible: boolean }>) => {
  if (!isValidDateValue(date)) return [] as IndicatorProcedureEvent[];
  return [...new Set(
    pairs
      .filter((pair) => pair.eligible && isNamedProfessional(pair.professional))
      .map((pair) => normalizeProfessional(pair.professional)),
  )].map((professional) => ({ date, professional }));
};
const buildMedicalNurseEvents = (date: string, cbo1: string | null | undefined, professional1: string | null | undefined, cbo2: string | null | undefined, professional2: string | null | undefined) =>
  buildQualifiedEvents(date, [
    { professional: professional1, eligible: isMedicalNurseCbo(cbo1) },
    { professional: professional2, eligible: isMedicalNurseCbo(cbo2) },
  ]);
const buildGeneralProcedureEvents = (date: string, cbo1: string | null | undefined, professional1: string | null | undefined, cbo2: string | null | undefined, professional2: string | null | undefined) =>
  buildQualifiedEvents(date, [
    { professional: professional1, eligible: isGeneralProcedureCbo(cbo1) },
    { professional: professional2, eligible: isGeneralProcedureCbo(cbo2) },
  ]);
const buildAcsEvents = (date: string, cbo: string | null | undefined, professional: string | null | undefined) =>
  buildQualifiedEvents(date, [{ professional, eligible: isAcsCbo(cbo) }]);
const buildSimpleEvents = (date: string, professionals: Array<string | null | undefined>) => {
  if (!isValidDateValue(date)) return [] as IndicatorProcedureEvent[];
  return [...new Set(professionals.map(normalizeProfessional).filter(isNamedProfessional))].map((professional) => ({ date, professional }));
};
const dedupeEvents = (events: IndicatorProcedureEvent[]) => {
  const map = new Map<string, IndicatorProcedureEvent>();
  for (const event of events) {
    if (!isValidDateValue(event.date) || !isNamedProfessional(event.professional)) continue;
    const normalized = { date: event.date, professional: normalizeProfessional(event.professional) };
    map.set(`${normalized.date}|${normalized.professional}`, normalized);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.professional.localeCompare(b.professional, "pt-BR"));
};
const distinctDates = (events: IndicatorProcedureEvent[]) => [...new Set(dedupeEvents(events).map((event) => event.date))].sort();
const getQuadrimesterEnd = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (month <= 4) return new Date(Date.UTC(year, 3, 30));
  if (month <= 8) return new Date(Date.UTC(year, 7, 31));
  return new Date(Date.UTC(year, 11, 31));
};
const formatDate = (value: string | null | undefined) => (isValidDateValue(value) ? toDate(value).toLocaleDateString("pt-BR") : "-");
const makeFlag = (
  key: IndicatorFlagKey,
  title: string,
  completed: boolean,
  metric: string,
  summary: string,
  detail: string,
  dueDate: Date,
  events: IndicatorProcedureEvent[] = [],
): IndicatorFlag => {
  const status: IndicatorFlagStatus = completed ? "done" : new Date().getTime() > dueDate.getTime() ? "attention" : "tracking";
  return {
    key,
    title,
    status,
    completed,
    points: FLAG_POINTS[key],
    earnedPoints: completed ? FLAG_POINTS[key] : 0,
    metric,
    summary,
    detail,
    deadline: { date: dueDate.toISOString().slice(0, 10), label: title },
    events: dedupeEvents(events),
  };
};
const upsertUnique = (map: Map<string, CitizenMatch | "AMBIGUOUS">, key: string, match: CitizenMatch) => {
  if (!key) return;
  const current = map.get(key);
  if (!current) {
    map.set(key, match);
    return;
  }
  if (current !== "AMBIGUOUS" && current.citizenId !== match.citizenId) map.set(key, "AMBIGUOUS");
};
const getUnique = (value: CitizenMatch | "AMBIGUOUS" | undefined) => (!value || value === "AMBIGUOUS" ? null : value);
const withinMonths = (date: string, months: number, now: Date) => {
  if (!isValidDateValue(date)) return false;
  return toDate(date).getTime() >= addMonths(now, -months).getTime();
};
const hasVisitInterval = (dates: string[], minimumDays: number) => {
  for (let i = 0; i < dates.length; i += 1) {
    for (let j = i + 1; j < dates.length; j += 1) {
      if (diffInDays(toDate(dates[i]), toDate(dates[j])) >= minimumDays) return true;
    }
  }
  return false;
};
const includesProcedure = (entry: ProcedureRow, codes: string[]) => {
  const normalizedCodes = new Set(codes.map(normalizeCode));
  return normalizedCodes.has(normalizeCode(entry.proc_a)) || normalizedCodes.has(normalizeCode(entry.proc_s));
};

const queryCitizenMatches = async (client: Client, rows: PatientInput[]) => {
  const cpfList = [...new Set(rows.map((row) => normalizeDigits(row.cpf)).filter(Boolean))];
  const cnsList = [...new Set(rows.map((row) => normalizeDigits(row.cns)).filter(Boolean))];
  const nameList = [...new Set(rows.map((row) => normalizeName(row.nome)).filter(Boolean))];
  const birthList = [...new Set(rows.map((row) => normalizeDateValue(row.nascimento)).filter(Boolean))];

  const cpfMap = new Map<string, CitizenMatch>();
  const cnsMap = new Map<string, CitizenMatch>();
  const nameBirthMap = new Map<string, CitizenMatch | "AMBIGUOUS">();
  const nameMap = new Map<string, CitizenMatch | "AMBIGUOUS">();
  const birthMap = new Map<string, CitizenMatch | "AMBIGUOUS">();

  const citizenBaseQuery = `
    select distinct on (p.co_seq_fat_cidadao_pec)
      p.co_seq_fat_cidadao_pec as citizen_id,
      regexp_replace(coalesce(p.nu_cpf_cidadao, ''), '\\D', '', 'g') as normalized_cpf,
      regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') as normalized_cns,
      upper(regexp_replace(trim(coalesce(p.no_cidadao, c.no_cidadao, '')), '\\s+', ' ', 'g')) as normalized_name,
      p.nu_cpf_cidadao as cpf_base,
      p.nu_cns as cns_base,
      coalesce(p.no_cidadao, c.no_cidadao) as nome_base,
      c.dt_nascimento::text as nascimento_base,
      c.no_sexo as sexo_base,
      coalesce(u.no_unidade_saude, '') as unidade_base,
      coalesce(a.no_equipe_vinc_equipe, '') as equipe_base
    from public.tb_fat_cidadao_pec p
    left join public.tb_cidadao c on c.co_seq_cidadao = p.co_cidadao
    left join public.tb_dim_unidade_saude u on u.co_seq_dim_unidade_saude = p.co_dim_unidade_saude_vinc
    left join public.tb_acomp_cidadaos_vinculados a on a.co_fat_cidadao_pec = p.co_seq_fat_cidadao_pec
    where %FILTER%
    order by p.co_seq_fat_cidadao_pec, c.dt_nascimento desc nulls last
  `;

  const mapRow = (row: Record<string, string | number | null>): CitizenMatch => ({
    citizenId: Number(row.citizen_id),
    cpf: row.cpf_base ? String(row.cpf_base) : null,
    cns: row.cns_base ? String(row.cns_base) : null,
    nome: row.nome_base ? String(row.nome_base) : null,
    nascimento: row.nascimento_base ? String(row.nascimento_base).slice(0, 10) : null,
    sexo: row.sexo_base ? String(row.sexo_base) : null,
    unidade: row.unidade_base ? String(row.unidade_base) : null,
    equipe: row.equipe_base ? String(row.equipe_base) : null,
  });

  if (cpfList.length > 0) {
    const result = await client.query(citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cpf_cidadao, ''), '\\D', '', 'g') = any($1::text[])"), [cpfList]);
    for (const row of result.rows) cpfMap.set(String(row.normalized_cpf), mapRow(row));
  }

  if (cnsList.length > 0) {
    const result = await client.query(citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') = any($1::text[])"), [cnsList]);
    for (const row of result.rows) cnsMap.set(String(row.normalized_cns), mapRow(row));
  }

  if (nameList.length > 0 || birthList.length > 0) {
    const conditions: string[] = [];
    const params: Array<string[]> = [];
    let index = 1;

    if (nameList.length > 0) {
      conditions.push(`upper(regexp_replace(trim(coalesce(p.no_cidadao, c.no_cidadao, '')), '\\s+', ' ', 'g')) = any($${index}::text[])`);
      params.push(nameList);
      index += 1;
    }

    if (birthList.length > 0) {
      conditions.push(`c.dt_nascimento::text = any($${index}::text[])`);
      params.push(birthList);
    }

    const result = await client.query(citizenBaseQuery.replace("%FILTER%", conditions.join(" or ")), params);
    for (const row of result.rows) {
      const match = mapRow(row);
      const name = row.normalized_name ? String(row.normalized_name) : "";
      const birth = match.nascimento ? normalizeDateValue(match.nascimento) : "";
      if (name && birth) upsertUnique(nameBirthMap, `${name}|${birth}`, match);
      if (name) upsertUnique(nameMap, name, match);
      if (birth) upsertUnique(birthMap, birth, match);
    }
  }

  return rows
    .map((row) => {
      const cpf = normalizeDigits(row.cpf);
      const cns = normalizeDigits(row.cns);
      const name = normalizeName(row.nome);
      const birth = normalizeDateValue(row.nascimento);
      const match =
        (cpf ? cpfMap.get(cpf) ?? null : null) ??
        (cns ? cnsMap.get(cns) ?? null : null) ??
        (name && birth ? getUnique(nameBirthMap.get(`${name}|${birth}`)) : null) ??
        (name ? getUnique(nameMap.get(name)) : null) ??
        (birth ? getUnique(birthMap.get(birth)) : null);
      return match ? { row, match } : null;
    })
    .filter(Boolean) as Array<{ row: PatientInput; match: CitizenMatch }>;
};

const buildFallbackPatient = (row: PatientInput, dueDate: Date): IndicatorPatient => {
  const flags = ([
    ["A", "Consulta por médica(o) ou enfermeira(o)"],
    ["B", "Peso e altura simultâneos"],
    ["C", "2 visitas ACS/TACS com 30 dias"],
    ["D", "Vacina influenza"],
  ] as Array<[IndicatorFlagKey, string]>).map(([key, title]) =>
    makeFlag(
      key,
      title,
      false,
      "Sem vínculo confirmado na base",
      "Paciente da lista nominal sem correspondência única na base externa.",
      "Verifique nome, CPF, CNS e data de nascimento para permitir o cruzamento com os procedimentos do C6.",
      dueDate,
    ),
  );

  return {
    index: row.index,
    nome: row.nome || "Paciente sem nome",
    cpf: normalizeDigits(row.cpf),
    cns: normalizeDigits(row.cns),
    nascimento: row.nascimento || "",
    sexo: row.sexo || "",
    unidade: row.unidade || "",
    equipe: row.equipe || "",
    idadeEmMeses: row.nascimento && isValidDateValue(row.nascimento) ? diffInMonths(toDate(row.nascimento), new Date()) : 0,
    totalPoints: 0,
    classification: "regular",
    completedFlags: 0,
    pendingFlags: flags.filter((flag) => flag.status === "attention").length,
    trackingFlags: flags.filter((flag) => flag.status === "tracking").length,
    flags,
    anthropometryRecords: [],
  };
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
  const rows = Array.isArray(body?.rows) ? (body.rows as PatientInput[]) : [];

  if (!rows.length) {
    return new Response(JSON.stringify({ success: false, error: "Nenhuma pessoa idosa foi enviada para cálculo do indicador C6." }), {
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

    const patientsWithMatch = await queryCitizenMatches(client, rows);
    const citizenIds = [...new Set(patientsWithMatch.map(({ match }) => match.citizenId))];
    const today = new Date();
    const quadrimesterEnd = getQuadrimesterEnd(today);
    const twelveMonthsAgoIso = formatIsoDate(addMonths(today, -12));

    if (!citizenIds.length) {
      const patients = rows.map((row) => buildFallbackPatient(row, quadrimesterEnd));
      return new Response(JSON.stringify({ success: true, patients }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [attendanceResult, procedureResult, visitResult, vaccineResult] = await Promise.all([
      client.query(
        `
          select
            ai.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            cbo1.nu_cbo as cbo1,
            cbo2.nu_cbo as cbo2,
            prof1.no_profissional as professional1,
            prof2.no_profissional as professional2,
            ai.nu_peso as weight,
            ai.nu_altura as height
          from public.tb_fat_atendimento_individual ai
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = ai.co_dim_tempo
          left join public.tb_dim_cbo cbo1 on cbo1.co_seq_dim_cbo = ai.co_dim_cbo_1
          left join public.tb_dim_cbo cbo2 on cbo2.co_seq_dim_cbo = ai.co_dim_cbo_2
          left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = ai.co_dim_profissional_1
          left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = ai.co_dim_profissional_2
          where ai.co_fat_cidadao_pec = any($1::bigint[])
            and t.dt_registro >= $2::date
        `,
        [citizenIds, twelveMonthsAgoIso],
      ),
      client.query(
        `
          select
            p.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            cbo1.nu_cbo as cbo1,
            cbo2.nu_cbo as cbo2,
            pa.co_proced as proc_a,
            ps.co_proced as proc_s,
            prof1.no_profissional as professional1,
            prof2.no_profissional as professional2
          from public.tb_fat_atd_ind_procedimentos p
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = p.co_dim_tempo
          left join public.tb_dim_cbo cbo1 on cbo1.co_seq_dim_cbo = p.co_dim_cbo_1
          left join public.tb_dim_cbo cbo2 on cbo2.co_seq_dim_cbo = p.co_dim_cbo_2
          left join public.tb_dim_procedimento pa on pa.co_seq_dim_procedimento = p.co_dim_procedimento_avaliado
          left join public.tb_dim_procedimento ps on ps.co_seq_dim_procedimento = p.co_dim_procedimento_solicitado
          left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = p.co_dim_profissional_1
          left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = p.co_dim_profissional_2
          where p.co_fat_cidadao_pec = any($1::bigint[])
            and t.dt_registro >= $2::date
        `,
        [citizenIds, twelveMonthsAgoIso],
      ),
      client.query(
        `
          select
            v.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            cbo.nu_cbo as cbo,
            prof.no_profissional as professional,
            v.nu_peso as weight,
            v.nu_altura as height,
            v.st_acomp_pessoa_doenca_cronica as chronic_followup
          from public.tb_fat_visita_domiciliar v
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = v.co_dim_tempo
          left join public.tb_dim_cbo cbo on cbo.co_seq_dim_cbo = v.co_dim_cbo
          left join public.tb_dim_profissional prof on prof.co_seq_dim_profissional = v.co_dim_profissional
          where v.co_fat_cidadao_pec = any($1::bigint[])
            and t.dt_registro >= $2::date
        `,
        [citizenIds, twelveMonthsAgoIso],
      ),
      client.query(
        `
          select
            fv.co_fat_cidadao_pec as citizen_id,
            coalesce(tv.dt_registro, t.dt_registro, fv.dt_inicial_atendimento::date)::text as event_date,
            im.nu_identificador as vaccine_code,
            coalesce(prof_vac.no_profissional, prof_app.no_profissional) as professional
          from public.tb_fat_vacinacao fv
          join public.tb_fat_vacinacao_vacina fvv on fvv.co_fat_vacinacao = fv.co_seq_fat_vacinacao
          left join public.tb_dim_tempo tv on tv.co_seq_dim_tempo = fvv.co_dim_tempo_vacina_aplicada
          left join public.tb_dim_tempo t on t.co_seq_dim_tempo = fv.co_dim_tempo
          left join public.tb_dim_imunobiologico im on im.co_seq_dim_imunobiologico = fvv.co_dim_imunobiologico
          left join public.tb_dim_profissional prof_vac on prof_vac.co_seq_dim_profissional = fvv.co_dim_profissional
          left join public.tb_dim_profissional prof_app on prof_app.co_seq_dim_profissional = fv.co_dim_profissional
          where fv.co_fat_cidadao_pec = any($1::bigint[])
            and coalesce(tv.dt_registro, t.dt_registro, fv.dt_inicial_atendimento::date) >= $2::date
        `,
        [citizenIds, twelveMonthsAgoIso],
      ),
    ]);

    const attendanceByCitizen = new Map<number, AttendanceRow[]>();
    for (const row of attendanceResult.rows as AttendanceRow[]) {
      const list = attendanceByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      attendanceByCitizen.set(Number(row.citizen_id), list);
    }

    const procedureByCitizen = new Map<number, ProcedureRow[]>();
    for (const row of procedureResult.rows as ProcedureRow[]) {
      const list = procedureByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      procedureByCitizen.set(Number(row.citizen_id), list);
    }

    const visitByCitizen = new Map<number, VisitRow[]>();
    for (const row of visitResult.rows as VisitRow[]) {
      const list = visitByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      visitByCitizen.set(Number(row.citizen_id), list);
    }

    const vaccineByCitizen = new Map<number, VaccineRow[]>();
    for (const row of vaccineResult.rows as VaccineRow[]) {
      const list = vaccineByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      vaccineByCitizen.set(Number(row.citizen_id), list);
    }

    const matchedRowIndexes = new Set(patientsWithMatch.map(({ row }) => row.index));
    const matchedPatients: IndicatorPatient[] = patientsWithMatch.map(({ row, match }) => {
      const citizenId = match.citizenId;
      const birthIso = normalizeDateValue(match.nascimento ?? row.nascimento);
      const birthDate = isValidDateValue(birthIso) ? toDate(birthIso) : today;
      const attendanceRows = (attendanceByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const procedureRows = (procedureByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const visitRows = (visitByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const vaccineRows = (vaccineByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));

      const consultationEvents = dedupeEvents([
        ...attendanceRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .flatMap((event) => buildMedicalNurseEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
        ...procedureRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .filter((event) => includesProcedure(event, CONSULTATION_CODES))
          .flatMap((event) => buildMedicalNurseEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
      ]);
      const consultationDates = distinctDates(consultationEvents);
      const flagACompleted = consultationDates.length >= 1;
      const flagA = makeFlag(
        "A",
        "Consulta por médica(o) ou enfermeira(o)",
        flagACompleted,
        flagACompleted ? `Última consulta em ${formatDate(consultationDates[consultationDates.length - 1])}` : "Nenhuma consulta válida nos últimos 12 meses",
        flagACompleted ? "Consulta elegível localizada dentro da janela de 12 meses." : "Ainda não foi localizada consulta médica ou de enfermagem na janela do indicador.",
        "Regra da nota metodológica C6: pelo menos 1 consulta presencial ou remota por médica(o) ou enfermeira(o) nos últimos 12 meses.",
        quadrimesterEnd,
        consultationEvents,
      );

      const anthropometryDateMap = new Map<string, IndicatorProcedureEvent[]>();
      const appendAnthropometry = (date: string, events: IndicatorProcedureEvent[]) => {
        if (!isValidDateValue(date) || events.length === 0) return;
        const current = anthropometryDateMap.get(date) ?? [];
        current.push(...events);
        anthropometryDateMap.set(date, current);
      };

      for (const event of attendanceRows) {
        const date = event.event_date.slice(0, 10);
        if (!withinMonths(date, 12, today)) continue;
        if (event.weight === null || event.weight === undefined || event.height === null || event.height === undefined) continue;
        appendAnthropometry(date, buildGeneralProcedureEvents(date, event.cbo1, event.professional1, event.cbo2, event.professional2));
      }

      for (const event of visitRows) {
        const date = event.event_date.slice(0, 10);
        if (!withinMonths(date, 12, today)) continue;
        if (event.weight === null || event.weight === undefined || event.height === null || event.height === undefined) continue;
        appendAnthropometry(date, buildQualifiedEvents(date, [{ professional: event.professional, eligible: isGeneralProcedureCbo(event.cbo) }]));
      }

      const procedureAnthropometry = new Map<string, { weight: boolean; height: boolean; anthropometry: boolean; events: IndicatorProcedureEvent[] }>();
      for (const event of procedureRows) {
        const date = event.event_date.slice(0, 10);
        if (!withinMonths(date, 12, today)) continue;
        const current = procedureAnthropometry.get(date) ?? { weight: false, height: false, anthropometry: false, events: [] };
        current.weight = current.weight || normalizeCode(event.proc_a) === WEIGHT_CODE || normalizeCode(event.proc_s) === WEIGHT_CODE;
        current.height = current.height || normalizeCode(event.proc_a) === HEIGHT_CODE || normalizeCode(event.proc_s) === HEIGHT_CODE;
        current.anthropometry = current.anthropometry || normalizeCode(event.proc_a) === ANTHROPOMETRY_CODE || normalizeCode(event.proc_s) === ANTHROPOMETRY_CODE;
        current.events.push(...buildGeneralProcedureEvents(date, event.cbo1, event.professional1, event.cbo2, event.professional2));
        procedureAnthropometry.set(date, current);
      }
      for (const [date, value] of procedureAnthropometry.entries()) {
        if ((value.anthropometry || (value.weight && value.height)) && value.events.length > 0) appendAnthropometry(date, value.events);
      }

      const anthropometryEvents = dedupeEvents([...anthropometryDateMap.values()].flat());
      const anthropometryDates = distinctDates(anthropometryEvents);
      const anthropometryRecords = [
        ...attendanceRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .filter((event) => event.weight !== null && event.weight !== undefined && event.height !== null && event.height !== undefined)
          .map((event) => ({
            date: event.event_date.slice(0, 10),
            weight: event.weight ?? null,
            height: event.height ?? null,
          })),
        ...visitRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .filter((event) => event.weight !== null && event.weight !== undefined && event.height !== null && event.height !== undefined)
          .map((event) => ({
            date: event.event_date.slice(0, 10),
            weight: event.weight ?? null,
            height: event.height ?? null,
          })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 2);
      const flagBCompleted = anthropometryDates.length >= 1;
      const flagB = makeFlag(
        "B",
        "Peso e altura simultâneos",
        flagBCompleted,
        flagBCompleted ? `Último registro em ${formatDate(anthropometryDates[anthropometryDates.length - 1])}` : "Sem registro simultâneo de peso e altura nos últimos 12 meses",
        flagBCompleted ? "Registro simultâneo de peso e altura localizado dentro da janela de 12 meses." : "Falta registro simultâneo de peso e altura na janela do indicador.",
        `Foram considerados campos específicos do atendimento/visita e SIGTAP ${ANTHROPOMETRY_CODE}, ${WEIGHT_CODE} e ${HEIGHT_CODE}, no mesmo dia.`,
        quadrimesterEnd,
        anthropometryEvents,
      );

      const visitEvents = dedupeEvents(
        visitRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .filter((event) => event.chronic_followup === 1 || event.chronic_followup === null)
          .flatMap((event) => buildAcsEvents(event.event_date.slice(0, 10), event.cbo, event.professional)),
      );
      const visitDates = distinctDates(visitEvents);
      const flagCCompleted = visitDates.length >= 2 && hasVisitInterval(visitDates, 30);
      const flagC = makeFlag(
        "C",
        "2 visitas ACS/TACS com 30 dias",
        flagCCompleted,
        `${visitDates.length}/2 visitas válidas`,
        flagCCompleted ? "Foram localizadas duas visitas domiciliares com intervalo mínimo de 30 dias." : "Ainda faltam visitas domiciliares válidas para completar a regra do indicador.",
        "Foram consideradas visitas domiciliares realizadas por ACS/TACS nos últimos 12 meses, com intervalo mínimo de 30 dias.",
        quadrimesterEnd,
        visitEvents,
      );

      const influenzaEvents = dedupeEvents(
        vaccineRows
          .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
          .filter((event) => INFLUENZA_CODES.includes(normalizeCode(event.vaccine_code)))
          .flatMap((event) => buildSimpleEvents(event.event_date.slice(0, 10), [event.professional])),
      );
      const influenzaDates = distinctDates(influenzaEvents);
      const flagDCompleted = influenzaDates.length >= 1;
      const flagD = makeFlag(
        "D",
        "Vacina influenza",
        flagDCompleted,
        flagDCompleted ? `Última dose em ${formatDate(influenzaDates[influenzaDates.length - 1])}` : "Sem dose de influenza nos últimos 12 meses",
        flagDCompleted ? "Dose de influenza localizada dentro da janela anual." : "Falta registro de vacina influenza na janela de 12 meses.",
        "Foram considerados os imunobiológicos 33 (influenza trivalente) e 77 (influenza tetravalente).",
        quadrimesterEnd,
        influenzaEvents,
      );

      const flags = [flagA, flagB, flagC, flagD];
      const totalPoints = flags.reduce((sum, flag) => sum + flag.earnedPoints, 0);

      return {
        index: row.index,
        nome: match.nome ?? row.nome ?? "Sem nome",
        cpf: match.cpf ?? row.cpf ?? "",
        cns: match.cns ?? row.cns ?? "",
        nascimento: birthIso,
        sexo: match.sexo ?? row.sexo ?? "",
        unidade: match.unidade ?? row.unidade ?? "",
        equipe: match.equipe ?? row.equipe ?? "",
        idadeEmMeses: isValidDateValue(birthIso) ? diffInMonths(birthDate, today) : 0,
        totalPoints,
        classification: getClassification(totalPoints),
        completedFlags: flags.filter((flag) => flag.status === "done").length,
        pendingFlags: flags.filter((flag) => flag.status === "attention").length,
        trackingFlags: flags.filter((flag) => flag.status === "tracking").length,
        flags,
        anthropometryRecords,
      } satisfies IndicatorPatient;
    });

    const fallbackPatients = rows
      .filter((row) => !matchedRowIndexes.has(row.index))
      .map((row) => buildFallbackPatient(row, quadrimesterEnd));

    const patients: IndicatorPatient[] = [...matchedPatients, ...fallbackPatients];
    patients.sort((a, b) => a.totalPoints - b.totalPoints || b.pendingFlags - a.pendingFlags || a.nome.localeCompare(b.nome, "pt-BR"));

    return new Response(JSON.stringify({ success: true, patients }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("c6-older-person-indicator error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Falha ao calcular o indicador C6.",
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
