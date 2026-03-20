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
  genderIdentity: string | null;
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
  evaluated_text?: string | null;
  requested_text?: string | null;
  cids_text?: string | null;
  ciaps_text?: string | null;
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

type ProblemRow = {
  citizen_id: number;
  event_date: string;
  cbo1?: string | null;
  cbo2?: string | null;
  professional1?: string | null;
  professional2?: string | null;
  cid_code?: string | null;
  ciap_code?: string | null;
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
};

type PatientProfile = {
  row: PatientInput;
  match: CitizenMatch;
  birthIso: string;
  ageYears: number;
  ageMonths: number;
  isFemaleSex: boolean;
  isTransMan: boolean;
  eligibleA: boolean;
  eligibleB: boolean;
  eligibleC: boolean;
  eligibleD: boolean;
};

const FLAG_POINTS: Record<IndicatorFlagKey, number> = {
  A: 20,
  B: 30,
  C: 30,
  D: 20,
};

const GENERAL_ELIGIBLE_CBO_PREFIXES = ["2235", "2231", "2251", "2252", "2253", "251605", "223445", "223605", "223810", "223710", "251510", "223905", "3222"];
const CERVICAL_SCREENING_CODES = ["0201020033", "0203010086", "0203010019", "0201020076", "0201020084"];
const BREAST_SCREENING_CODES = ["0204030030", "0204030188"];
const HPV_VACCINE_CODES = ["67", "93"];
const SRH_CIAP_CODES = ["B25", "W02", "W10", "W11", "W12", "W13", "W14", "W15", "W79", "W82", "X01", "X02", "X03", "X04", "X05", "X06", "X07", "X08", "X09", "X10", "X11", "X12", "X13", "X23", "X24", "X82", "X89", "Y14"];
const SRH_CID_PREFIXES = ["N80", "N91", "N92", "N93", "N94", "N95", "N96", "N97", "O03", "O04", "R102", "T742", "Y050", "Y051", "Y052", "Y053", "Y054", "Y055", "Y056", "Y057", "Y058", "Y059", "Z123", "Z124", "Z205", "Z206", "Z30", "Z31", "Z320", "Z600", "Z630", "Z640", "Z70", "Z717", "Z725"];
const SRH_ABP_CODES = ["ABP003", "ABP022", "ABP023"];

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
const ageYearsOn = (birthDate: Date, targetDate: Date) => Math.floor(diffInMonths(birthDate, targetDate) / 12);
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
const isGeneralEligibleCbo = (value: string | null | undefined) => startsWithAny(normalizeCbo(value), GENERAL_ELIGIBLE_CBO_PREFIXES);
const buildQualifiedEvents = (date: string, pairs: Array<{ professional: string | null | undefined; eligible: boolean }>) => {
  if (!isValidDateValue(date)) return [] as IndicatorProcedureEvent[];
  return [...new Set(
    pairs
      .filter((pair) => pair.eligible && isNamedProfessional(pair.professional))
      .map((pair) => normalizeProfessional(pair.professional)),
  )].map((professional) => ({ date, professional }));
};
const buildGeneralEvents = (date: string, cbo1: string | null | undefined, professional1: string | null | undefined, cbo2: string | null | undefined, professional2: string | null | undefined) =>
  buildQualifiedEvents(date, [
    { professional: professional1, eligible: isGeneralEligibleCbo(cbo1) },
    { professional: professional2, eligible: isGeneralEligibleCbo(cbo2) },
  ]);
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
const withinMonths = (date: string, months: number, now: Date) => {
  if (!isValidDateValue(date)) return false;
  return toDate(date).getTime() >= addMonths(now, -months).getTime();
};
const textContainsAnyCode = (value: string | null | undefined, codes: string[]) => {
  const normalized = normalizeCode(value);
  if (!normalized) return false;
  return codes.some((code) => normalized.includes(normalizeCode(code)));
};
const textContainsAnyPrefix = (value: string | null | undefined, prefixes: string[]) => {
  const normalized = normalizeCode(value);
  if (!normalized) return false;
  return prefixes.some((prefix) => normalized.includes(normalizeCode(prefix)));
};
const codeMatchesAny = (value: string | null | undefined, codes: string[]) => codes.includes(normalizeCode(value));
const codeStartsWithAny = (value: string | null | undefined, prefixes: string[]) => startsWithAny(normalizeCode(value), prefixes.map(normalizeCode));
const includesProcedure = (entry: ProcedureRow, codes: string[]) => codeMatchesAny(entry.proc_a, codes) || codeMatchesAny(entry.proc_s, codes);
const includesAnySrhEvidence = (entry: AttendanceRow) =>
  textContainsAnyPrefix(entry.cids_text, SRH_CID_PREFIXES) ||
  textContainsAnyCode(entry.ciaps_text, SRH_CIAP_CODES) ||
  textContainsAnyCode(entry.evaluated_text, SRH_ABP_CODES) ||
  textContainsAnyCode(entry.requested_text, SRH_ABP_CODES);
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
const makeNotApplicableFlag = (key: IndicatorFlagKey, title: string, reason: string): IndicatorFlag => ({
  key,
  title,
  status: "done",
  completed: true,
  points: FLAG_POINTS[key],
  earnedPoints: FLAG_POINTS[key],
  metric: "Não se aplica ao perfil etário/sexo",
  summary: reason,
  detail: `${reason} A boa prática não reduz a pontuação deste registro.`,
  deadline: null,
  events: [],
});
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
      c.tp_identidade_genero as gender_identity,
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
    genderIdentity: row.gender_identity ? String(row.gender_identity) : null,
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
    ["A", "Rastreamento do colo do útero"],
    ["B", "Vacina HPV"],
    ["C", "Atenção à saúde sexual e reprodutiva"],
    ["D", "Rastreamento do câncer de mama"],
  ] as Array<[IndicatorFlagKey, string]>).map(([key, title]) =>
    makeFlag(
      key,
      title,
      false,
      "Sem vínculo confirmado na base",
      "Paciente da lista nominal sem correspondência única na base externa.",
      "Verifique nome, CPF, CNS e data de nascimento para permitir o cruzamento com os procedimentos do C7.",
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
    return new Response(JSON.stringify({ success: false, error: "Nenhuma pessoa foi enviada para cálculo do indicador C7." }), {
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

    const today = new Date();
    const quadrimesterEnd = getQuadrimesterEnd(today);
    const twelveMonthsAgoIso = formatIsoDate(addMonths(today, -12));
    const twentyFourMonthsAgoIso = formatIsoDate(addMonths(today, -24));
    const thirtySixMonthsAgoIso = formatIsoDate(addMonths(today, -36));

    const patientsWithMatch = await queryCitizenMatches(client, rows);
    const matchedRowIndexes = new Set(patientsWithMatch.map(({ row }) => row.index));

    if (!patientsWithMatch.length) {
      const patients = rows.map((row) => buildFallbackPatient(row, quadrimesterEnd));
      return new Response(JSON.stringify({ success: true, patients }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profiles: PatientProfile[] = patientsWithMatch.map(({ row, match }) => {
      const birthIso = normalizeDateValue(match.nascimento ?? row.nascimento);
      const birthDate = isValidDateValue(birthIso) ? toDate(birthIso) : today;
      const ageMonths = isValidDateValue(birthIso) ? diffInMonths(birthDate, today) : 0;
      const ageYears = Math.floor(ageMonths / 12);
      const sexLabel = normalizeLabel(match.sexo ?? row.sexo);
      const genderIdentity = normalizeLabel(match.genderIdentity);
      const isFemaleSex = sexLabel.includes("FEM") || sexLabel === "F";
      const isTransMan = genderIdentity === "HOMEMTRANS";
      const eligibleA = ageYears >= 25 && ageYears <= 64 && (isFemaleSex || isTransMan);
      const eligibleB = ageYears >= 9 && ageYears <= 14 && isFemaleSex;
      const eligibleC = ageYears >= 14 && ageYears <= 69 && (isFemaleSex || isTransMan);
      const eligibleD = ageYears >= 50 && ageYears <= 69 && (isFemaleSex || isTransMan);
      return { row, match, birthIso, ageYears, ageMonths, isFemaleSex, isTransMan, eligibleA, eligibleB, eligibleC, eligibleD };
    });

    const attendanceIds = [...new Set(profiles.filter((profile) => profile.eligibleA || profile.eligibleC || profile.eligibleD).map((profile) => profile.match.citizenId))];
    const procedureIds = [...new Set(profiles.filter((profile) => profile.eligibleA || profile.eligibleC || profile.eligibleD).map((profile) => profile.match.citizenId))];
    const problemIds = [...new Set(profiles.filter((profile) => profile.eligibleC).map((profile) => profile.match.citizenId))];
    const vaccineIds = [...new Set(profiles.filter((profile) => profile.eligibleB).map((profile) => profile.match.citizenId))];
    const relevantProcedureCodes = [...new Set([...CERVICAL_SCREENING_CODES, ...BREAST_SCREENING_CODES, ...SRH_ABP_CODES])];

    const [attendanceResult, procedureResult, problemResult, vaccineResult] = await Promise.all([
      attendanceIds.length
        ? client.query(
            `
              select
                ai.co_fat_cidadao_pec as citizen_id,
                t.dt_registro::text as event_date,
                cbo1.nu_cbo as cbo1,
                cbo2.nu_cbo as cbo2,
                prof1.no_profissional as professional1,
                prof2.no_profissional as professional2,
                ai.ds_filtro_proced_avaliados as evaluated_text,
                ai.ds_filtro_proced_solicitados as requested_text,
                ai.ds_filtro_cids as cids_text,
                ai.ds_filtro_ciaps as ciaps_text
              from public.tb_fat_atendimento_individual ai
              join public.tb_dim_tempo t on t.co_seq_dim_tempo = ai.co_dim_tempo
              left join public.tb_dim_cbo cbo1 on cbo1.co_seq_dim_cbo = ai.co_dim_cbo_1
              left join public.tb_dim_cbo cbo2 on cbo2.co_seq_dim_cbo = ai.co_dim_cbo_2
              left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = ai.co_dim_profissional_1
              left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = ai.co_dim_profissional_2
              where ai.co_fat_cidadao_pec = any($1::bigint[])
                and t.dt_registro >= $2::date
            `,
            [attendanceIds, thirtySixMonthsAgoIso],
          )
        : Promise.resolve({ rows: [] as AttendanceRow[] }),
      procedureIds.length
        ? client.query(
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
                and (
                  pa.co_proced = any($3::text[])
                  or ps.co_proced = any($3::text[])
                )
            `,
            [procedureIds, thirtySixMonthsAgoIso, relevantProcedureCodes],
          )
        : Promise.resolve({ rows: [] as ProcedureRow[] }),
      problemIds.length
        ? client.query(
            `
              select
                p.co_fat_cidadao_pec as citizen_id,
                t.dt_registro::text as event_date,
                cbo1.nu_cbo as cbo1,
                cbo2.nu_cbo as cbo2,
                prof1.no_profissional as professional1,
                prof2.no_profissional as professional2,
                cid.nu_cid as cid_code,
                ciap.nu_ciap as ciap_code
              from public.tb_fat_atd_ind_problemas p
              join public.tb_dim_tempo t on t.co_seq_dim_tempo = p.co_dim_tempo
              left join public.tb_dim_cbo cbo1 on cbo1.co_seq_dim_cbo = p.co_dim_cbo_1
              left join public.tb_dim_cbo cbo2 on cbo2.co_seq_dim_cbo = p.co_dim_cbo_2
              left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = p.co_dim_profissional_1
              left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = p.co_dim_profissional_2
              left join public.tb_dim_cid cid on cid.co_seq_dim_cid = p.co_dim_cid
              left join public.tb_dim_ciap ciap on ciap.co_seq_dim_ciap = p.co_dim_ciap
              where p.co_fat_cidadao_pec = any($1::bigint[])
                and t.dt_registro >= $2::date
            `,
            [problemIds, twelveMonthsAgoIso],
          )
        : Promise.resolve({ rows: [] as ProblemRow[] }),
      vaccineIds.length
        ? client.query(
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
                and im.nu_identificador = any($2::text[])
            `,
            [vaccineIds, HPV_VACCINE_CODES],
          )
        : Promise.resolve({ rows: [] as VaccineRow[] }),
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

    const problemByCitizen = new Map<number, ProblemRow[]>();
    for (const row of problemResult.rows as ProblemRow[]) {
      const list = problemByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      problemByCitizen.set(Number(row.citizen_id), list);
    }

    const vaccineByCitizen = new Map<number, VaccineRow[]>();
    for (const row of vaccineResult.rows as VaccineRow[]) {
      const list = vaccineByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      vaccineByCitizen.set(Number(row.citizen_id), list);
    }

    const matchedPatients: IndicatorPatient[] = profiles.map((profile) => {
      const { row, match, birthIso, ageMonths, eligibleA, eligibleB, eligibleC, eligibleD } = profile;
      const birthDate = isValidDateValue(birthIso) ? toDate(birthIso) : today;
      const citizenId = match.citizenId;
      const attendanceRows = (attendanceByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const procedureRows = (procedureByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const problemRows = (problemByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));
      const vaccineRows = (vaccineByCitizen.get(citizenId) ?? []).filter((event) => isValidDateValue(event.event_date.slice(0, 10)));

      const flagA = eligibleA
        ? (() => {
            const events = dedupeEvents([
              ...attendanceRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 36, today))
                .filter((event) => textContainsAnyCode(event.evaluated_text, CERVICAL_SCREENING_CODES) || textContainsAnyCode(event.requested_text, CERVICAL_SCREENING_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
              ...procedureRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 36, today))
                .filter((event) => includesProcedure(event, CERVICAL_SCREENING_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
            ]);
            const dates = distinctDates(events);
            const completed = dates.length >= 1;
            return makeFlag(
              "A",
              "Rastreamento do colo do útero",
              completed,
              completed ? `Último registro em ${formatDate(dates[dates.length - 1])}` : "Sem PCCU/HPV molecular nos últimos 36 meses",
              completed ? "Foi localizado exame de rastreamento do colo do útero dentro da janela exigida." : "Ainda não foi localizado exame de rastreamento do colo do útero na janela do indicador.",
              `Foram considerados os procedimentos ${CERVICAL_SCREENING_CODES.join(", ")} coletados, solicitados ou avaliados nos últimos 36 meses.`,
              quadrimesterEnd,
              events,
            );
          })()
        : makeNotApplicableFlag("A", "Rastreamento do colo do útero", "Boa prática aplicável apenas a mulheres e homens trans entre 25 e 64 anos.");

      const flagB = eligibleB
        ? (() => {
            const events = dedupeEvents(
              vaccineRows
                .filter((event) => HPV_VACCINE_CODES.includes(normalizeCode(event.vaccine_code)))
                .filter((event) => {
                  const eventDate = event.event_date.slice(0, 10);
                  if (!isValidDateValue(eventDate) || !isValidDateValue(birthIso)) return false;
                  const ageAtDose = ageYearsOn(birthDate, toDate(eventDate));
                  return ageAtDose >= 9 && ageAtDose <= 14;
                })
                .flatMap((event) => buildSimpleEvents(event.event_date.slice(0, 10), [event.professional])),
            );
            const dates = distinctDates(events);
            const completed = dates.length >= 1;
            return makeFlag(
              "B",
              "Vacina HPV",
              completed,
              completed ? `Dose registrada em ${formatDate(dates[dates.length - 1])}` : "Sem dose válida de HPV na faixa de 9 a 14 anos",
              completed ? "Foi localizada dose de vacina HPV na faixa etária elegível." : "Ainda não foi localizada dose de vacina HPV válida para a regra do indicador.",
              "Foram considerados os imunobiológicos 67 (HPV quadrivalente) e 93 (HPV nonavalente), aplicados entre 9 e 14 anos.",
              quadrimesterEnd,
              events,
            );
          })()
        : makeNotApplicableFlag("B", "Vacina HPV", "Boa prática aplicável apenas ao sexo feminino entre 9 e 14 anos.");

      const flagC = eligibleC
        ? (() => {
            const events = dedupeEvents([
              ...attendanceRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
                .filter((event) => includesAnySrhEvidence(event))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
              ...problemRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
                .filter((event) => codeStartsWithAny(event.cid_code, SRH_CID_PREFIXES) || codeMatchesAny(event.ciap_code, SRH_CIAP_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
              ...procedureRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 12, today))
                .filter((event) => includesProcedure(event, SRH_ABP_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
            ]);
            const dates = distinctDates(events);
            const completed = dates.length >= 1;
            return makeFlag(
              "C",
              "Atenção à saúde sexual e reprodutiva",
              completed,
              completed ? `Último atendimento em ${formatDate(dates[dates.length - 1])}` : "Sem atendimento elegível nos últimos 12 meses",
              completed ? "Foi localizado atendimento ou registro clínico elegível para saúde sexual e reprodutiva." : "Ainda não foi localizado atendimento de saúde sexual e reprodutiva na janela de 12 meses.",
              "Foram considerados CID, CIAP e códigos ABP previstos na nota metodológica, com profissional elegível identificado.",
              quadrimesterEnd,
              events,
            );
          })()
        : makeNotApplicableFlag("C", "Atenção à saúde sexual e reprodutiva", "Boa prática aplicável a adolescentes do sexo feminino, mulheres e homens trans entre 14 e 69 anos.");

      const flagD = eligibleD
        ? (() => {
            const events = dedupeEvents([
              ...attendanceRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 24, today))
                .filter((event) => textContainsAnyCode(event.evaluated_text, BREAST_SCREENING_CODES) || textContainsAnyCode(event.requested_text, BREAST_SCREENING_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
              ...procedureRows
                .filter((event) => withinMonths(event.event_date.slice(0, 10), 24, today))
                .filter((event) => includesProcedure(event, BREAST_SCREENING_CODES))
                .flatMap((event) => buildGeneralEvents(event.event_date.slice(0, 10), event.cbo1, event.professional1, event.cbo2, event.professional2)),
            ]);
            const dates = distinctDates(events);
            const completed = dates.length >= 1;
            return makeFlag(
              "D",
              "Rastreamento do câncer de mama",
              completed,
              completed ? `Último registro em ${formatDate(dates[dates.length - 1])}` : "Sem mamografia válida nos últimos 24 meses",
              completed ? "Foi localizado exame de rastreamento do câncer de mama dentro da janela exigida." : "Ainda não foi localizada mamografia válida na janela do indicador.",
              `Foram considerados os procedimentos ${BREAST_SCREENING_CODES.join(", ")} solicitados ou avaliados nos últimos 24 meses.`,
              quadrimesterEnd,
              events,
            );
          })()
        : makeNotApplicableFlag("D", "Rastreamento do câncer de mama", "Boa prática aplicável apenas a mulheres e homens trans entre 50 e 69 anos.");

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
        idadeEmMeses: ageMonths,
        totalPoints,
        classification: getClassification(totalPoints),
        completedFlags: flags.filter((flag) => flag.status === "done").length,
        pendingFlags: flags.filter((flag) => flag.status === "attention").length,
        trackingFlags: flags.filter((flag) => flag.status === "tracking").length,
        flags,
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
    console.error("c7-pccu-prevention-indicator error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Falha ao calcular o indicador C7.",
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
