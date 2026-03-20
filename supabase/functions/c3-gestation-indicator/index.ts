import { Client } from "npm:pg@8.16.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IndicatorFlagKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";
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

type SummaryRow = {
  citizenId: number;
  gestationStart: string | null;
  puerperiumStart: string | null;
  puerperiumEnd: string | null;
  dum: string | null;
  lastPrenatalDate: string | null;
  puerperalConsultationDate: string | null;
  gestationalAgeWeeks: number | null;
};

type EventRow = {
  citizen_id: number;
  event_date: string;
  cbo1?: string | null;
  cbo2?: string | null;
  professional1?: string | null;
  professional2?: string | null;
  weight?: number | null;
  height?: number | null;
};

type ProcedureRow = EventRow & {
  proc_a?: string | null;
  proc_s?: string | null;
};

type VisitRow = {
  citizen_id: number;
  event_date: string;
  cbo?: string | null;
  professional?: string | null;
  weight?: number | null;
  height?: number | null;
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
  A: 10,
  B: 9,
  C: 9,
  D: 9,
  E: 9,
  F: 9,
  G: 9,
  H: 9,
  I: 9,
  J: 9,
  K: 9,
};

const MEDICAL_CBO_PREFIXES = ["2231", "2235", "2251", "2252", "2253"];
const ACS_CBO_CODES = ["515105", "322255"];
const DENTAL_CBO_PREFIXES = ["2232", "3224"];
const CONSULTATION_CODES = ["0301010030", "0301010064", "0301010110", "0301010129", "0301010250"];
const PRESSURE_CODES = ["0301100039"];
const ANTHROPOMETRY_ASSESSMENT_CODE = "0101040024";
const WEIGHT_CODE = "0101040083";
const HEIGHT_CODE = "0101040075";
const DTPA_CODES = ["57"];
const FIRST_TRIMESTER_GROUPS = {
  sifilis: ["0214010074", "0214010082", "0214010252", "0202031098", "0202031110", "0202031179"],
  hiv: ["0214010040", "0214010279", "0214010058", "0213010780", "0213010500"],
  hbv: ["0214010104", "0214010236", "0202030784", "0202030970", "0213010208"],
  hcv: ["0214010090", "0214010309", "0202030059", "0202030679"],
};
const THIRD_TRIMESTER_GROUPS = {
  sifilis: FIRST_TRIMESTER_GROUPS.sifilis,
  hiv: FIRST_TRIMESTER_GROUPS.hiv,
};

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizeCode = (value: unknown) => String(value ?? "").replace(/\D/g, "");
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
const isValidDateValue = (value: string | null | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime()));
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};
const addWeeks = (date: Date, weeks: number) => addDays(date, weeks * 7);
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
const isMedicalCbo = (value: string | null | undefined) => MEDICAL_CBO_PREFIXES.some((prefix) => normalizeCbo(value).startsWith(prefix));
const isAcsCbo = (value: string | null | undefined) => ACS_CBO_CODES.includes(normalizeCbo(value));
const isDentalCbo = (value: string | null | undefined) => DENTAL_CBO_PREFIXES.some((prefix) => normalizeCbo(value).startsWith(prefix));
const buildQualifiedEvents = (
  date: string,
  pairs: Array<{ professional: string | null | undefined; eligible: boolean }>,
) => {
  if (!isValidDateValue(date)) return [] as IndicatorProcedureEvent[];
  return [...new Set(
    pairs
      .filter((pair) => pair.eligible && isNamedProfessional(pair.professional))
      .map((pair) => normalizeProfessional(pair.professional)),
  )].map((professional) => ({ date, professional }));
};
const buildMedicalEvents = (date: string, cbo1: string | null | undefined, professional1: string | null | undefined, cbo2: string | null | undefined, professional2: string | null | undefined) =>
  buildQualifiedEvents(date, [
    { professional: professional1, eligible: isMedicalCbo(cbo1) },
    { professional: professional2, eligible: isMedicalCbo(cbo2) },
  ]);
const buildDentalEvents = (date: string, cbo1: string | null | undefined, professional1: string | null | undefined, cbo2: string | null | undefined, professional2: string | null | undefined) =>
  buildQualifiedEvents(date, [
    { professional: professional1, eligible: isDentalCbo(cbo1) },
    { professional: professional2, eligible: isDentalCbo(cbo2) },
  ]);
const buildAcsEvents = (date: string, cbo: string | null | undefined, professional: string | null | undefined) =>
  buildQualifiedEvents(date, [{ professional, eligible: isAcsCbo(cbo) }]);
const withinRange = (date: string, start: string | null, end: string | null) => {
  if (!isValidDateValue(date)) return false;
  const current = toDate(date);
  if (start && isValidDateValue(start) && current.getTime() < toDate(start).getTime()) return false;
  if (end && isValidDateValue(end) && current.getTime() > toDate(end).getTime()) return false;
  return true;
};
const getRowValue = (row: ParsedRow | undefined, aliases: string[]) => {
  if (!row) return "";
  const key = Object.keys(row).find((candidate) => aliases.some((alias) => normalizeLabel(candidate) === normalizeLabel(alias)));
  return key ? String(row[key] ?? "") : "";
};
const getFallbackGestationStart = (row: PatientInput) => normalizeDateValue(getRowValue(row.sourceRow, ["DUM", "DATA_ULTIMA_MENSTRUACAO", "DT_DUM", "DT_INICIO_GESTACAO"]));
const getFallbackGestationEnd = (row: PatientInput, gestationStart: string | null) => {
  const explicit = normalizeDateValue(getRowValue(row.sourceRow, ["DPP", "DATA_PROVAVEL_PARTO", "DT_DPP", "DT_INICIO_PUERPERIO"]));
  if (explicit) return explicit;
  if (gestationStart && isValidDateValue(gestationStart)) return addDays(toDate(gestationStart), 294).toISOString().slice(0, 10);
  return null;
};
const buildEvents = (date: string, professionals: Array<string | null | undefined>) => {
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
const makeFlag = (
  key: IndicatorFlagKey,
  title: string,
  completed: boolean,
  metric: string,
  summary: string,
  detail: string,
  dueDate: string | null,
  fallbackTracking = true,
  events: IndicatorProcedureEvent[] = [],
): IndicatorFlag => {
  const now = new Date();
  const due = dueDate && isValidDateValue(dueDate) ? toDate(dueDate) : null;
  const status: IndicatorFlagStatus = completed ? "done" : due && now.getTime() > due.getTime() ? "attention" : fallbackTracking ? "tracking" : "attention";
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
    deadline: dueDate && isValidDateValue(dueDate) ? { date: dueDate, label: title } : null,
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
const includesProcedure = (row: ProcedureRow, codes: string[]) => {
  const evaluated = normalizeCode(row.proc_a);
  const requested = normalizeCode(row.proc_s);
  return codes.includes(evaluated) || codes.includes(requested);
};
const groupEventsByDate = (events: IndicatorProcedureEvent[]) => {
  const grouped = new Map<string, IndicatorProcedureEvent[]>();
  for (const event of dedupeEvents(events)) {
    const list = grouped.get(event.date) ?? [];
    list.push(event);
    grouped.set(event.date, list);
  }
  return grouped;
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

  return new Map<string, CitizenMatch | null>(
    rows.map((row) => {
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
      return [`${row.index}`, match ?? null];
    }),
  );
};

const querySummaryRows = async (client: Client, citizenIds: number[]) => {
  if (!citizenIds.length) return new Map<number, SummaryRow>();
  const result = await client.query(
    `
      select
        co_fat_cidadao_pec as citizen_id,
        coalesce(to_char(dt_inicio_gestacao, 'YYYY-MM-DD'), '') as gestation_start,
        coalesce(to_char(dt_inicio_puerperio, 'YYYY-MM-DD'), '') as puerperium_start,
        coalesce(to_char(dt_fim_puerperio, 'YYYY-MM-DD'), '') as puerperium_end,
        coalesce(to_char(dt_fai_dum, 'YYYY-MM-DD'), '') as dum,
        coalesce(to_char(dt_ultima_fai_pre_natal, 'YYYY-MM-DD'), '') as last_prenatal_date,
        coalesce(to_char(dt_fai_puerperio, 'YYYY-MM-DD'), '') as puerperal_consultation_date,
        nu_idade_gestacional as gestational_age_weeks
      from public.tb_fat_rel_op_gestante
      where co_fat_cidadao_pec = any($1::bigint[])
      order by co_fat_cidadao_pec, coalesce(dt_inicio_gestacao, dt_inicio_puerperio, dt_fai_dum, dt_ultima_fai_pre_natal) desc nulls last, co_seq_fat_rel_op_gestante desc
    `,
    [citizenIds],
  );

  const map = new Map<number, SummaryRow>();
  for (const row of result.rows) {
    const citizenId = Number(row.citizen_id);
    if (map.has(citizenId)) continue;
    map.set(citizenId, {
      citizenId,
      gestationStart: normalizeDateValue(row.gestation_start) || null,
      puerperiumStart: normalizeDateValue(row.puerperium_start) || null,
      puerperiumEnd: normalizeDateValue(row.puerperium_end) || null,
      dum: normalizeDateValue(row.dum) || null,
      lastPrenatalDate: normalizeDateValue(row.last_prenatal_date) || null,
      puerperalConsultationDate: normalizeDateValue(row.puerperal_consultation_date) || null,
      gestationalAgeWeeks: row.gestational_age_weeks !== null && row.gestational_age_weeks !== undefined ? Number(row.gestational_age_weeks) : null,
    });
  }
  return map;
};

const queryEvidence = async (client: Client, citizenIds: number[]) => {
  if (!citizenIds.length) {
    return {
      attendanceRowsByCitizen: new Map<number, EventRow[]>(),
      procedureRowsByCitizen: new Map<number, ProcedureRow[]>(),
      visitRowsByCitizen: new Map<number, VisitRow[]>(),
      vaccineRowsByCitizen: new Map<number, VaccineRow[]>(),
    };
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
      `,
      [citizenIds],
    ),
    client.query(
      `
        select
          p.co_fat_cidadao_pec as citizen_id,
          t.dt_registro::text as event_date,
          pa.co_proced as proc_a,
          ps.co_proced as proc_s,
          cbo1.nu_cbo as cbo1,
          cbo2.nu_cbo as cbo2,
          prof1.no_profissional as professional1,
          prof2.no_profissional as professional2
        from public.tb_fat_atd_ind_procedimentos p
        join public.tb_dim_tempo t on t.co_seq_dim_tempo = p.co_dim_tempo
        left join public.tb_dim_procedimento pa on pa.co_seq_dim_procedimento = p.co_dim_procedimento_avaliado
        left join public.tb_dim_procedimento ps on ps.co_seq_dim_procedimento = p.co_dim_procedimento_solicitado
        left join public.tb_dim_cbo cbo1 on cbo1.co_seq_dim_cbo = p.co_dim_cbo_1
        left join public.tb_dim_cbo cbo2 on cbo2.co_seq_dim_cbo = p.co_dim_cbo_2
        left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = p.co_dim_profissional_1
        left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = p.co_dim_profissional_2
        where p.co_fat_cidadao_pec = any($1::bigint[])
      `,
      [citizenIds],
    ),
    client.query(
      `
        select
          v.co_fat_cidadao_pec as citizen_id,
          t.dt_registro::text as event_date,
          cbo.nu_cbo as cbo,
          prof.no_profissional as professional,
          v.nu_peso as weight,
          v.nu_altura as height
        from public.tb_fat_visita_domiciliar v
        join public.tb_dim_tempo t on t.co_seq_dim_tempo = v.co_dim_tempo
        left join public.tb_dim_cbo cbo on cbo.co_seq_dim_cbo = v.co_dim_cbo
        left join public.tb_dim_profissional prof on prof.co_seq_dim_profissional = v.co_dim_profissional
        where v.co_fat_cidadao_pec = any($1::bigint[])
      `,
      [citizenIds],
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
      `,
      [citizenIds],
    ),
  ]);

  const attendanceRowsByCitizen = new Map<number, EventRow[]>();
  for (const row of attendanceResult.rows as EventRow[]) {
    const citizenId = Number(row.citizen_id);
    const list = attendanceRowsByCitizen.get(citizenId) ?? [];
    list.push(row);
    attendanceRowsByCitizen.set(citizenId, list);
  }

  const procedureRowsByCitizen = new Map<number, ProcedureRow[]>();
  for (const row of procedureResult.rows as ProcedureRow[]) {
    const citizenId = Number(row.citizen_id);
    const list = procedureRowsByCitizen.get(citizenId) ?? [];
    list.push(row);
    procedureRowsByCitizen.set(citizenId, list);
  }

  const visitRowsByCitizen = new Map<number, VisitRow[]>();
  for (const row of visitResult.rows as VisitRow[]) {
    const citizenId = Number(row.citizen_id);
    const list = visitRowsByCitizen.get(citizenId) ?? [];
    list.push(row);
    visitRowsByCitizen.set(citizenId, list);
  }

  const vaccineRowsByCitizen = new Map<number, VaccineRow[]>();
  for (const row of vaccineResult.rows as VaccineRow[]) {
    const citizenId = Number(row.citizen_id);
    const list = vaccineRowsByCitizen.get(citizenId) ?? [];
    list.push(row);
    vaccineRowsByCitizen.set(citizenId, list);
  }

  return { attendanceRowsByCitizen, procedureRowsByCitizen, visitRowsByCitizen, vaccineRowsByCitizen };
};

const buildFallbackPatient = (row: PatientInput): IndicatorPatient => {
  const flags = ([
    ["A", "1ª consulta até 12 semanas"],
    ["B", "07 consultas na gestação"],
    ["C", "07 aferições de pressão arterial"],
    ["D", "07 registros simultâneos de peso e altura"],
    ["E", "03 visitas domiciliares por ACS/TACS"],
    ["F", "Vacina dTpa após 20 semanas"],
    ["G", "Testes do 1º trimestre"],
    ["H", "Testes do 3º trimestre"],
    ["I", "Consulta no puerpério"],
    ["J", "Visita domiciliar no puerpério"],
    ["K", "Atividade de saúde bucal"],
  ] as Array<[IndicatorFlagKey, string]>).map(([key, title]) =>
    makeFlag(key, title, false, "Sem vínculo confirmado na base", "Paciente da lista nominal sem correspondência única na base externa.", "Verifique nome, CPF, CNS e qualidade do cadastro para permitir o cruzamento com os procedimentos do C3.", null, true),
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
    pendingFlags: 0,
    trackingFlags: flags.length,
    flags,
  };
};

const buildMatchedPatient = (
  row: PatientInput,
  match: CitizenMatch,
  summary: SummaryRow | undefined,
  evidence: {
    attendanceRowsByCitizen: Map<number, EventRow[]>;
    procedureRowsByCitizen: Map<number, ProcedureRow[]>;
    visitRowsByCitizen: Map<number, VisitRow[]>;
    vaccineRowsByCitizen: Map<number, VaccineRow[]>;
  },
): IndicatorPatient => {
  const citizenId = match.citizenId;
  const now = new Date();
  const gestationStart = summary?.dum || summary?.gestationStart || getFallbackGestationStart(row) || null;
  const gestationEnd = summary?.puerperiumStart || getFallbackGestationEnd(row, gestationStart) || (gestationStart && isValidDateValue(gestationStart) ? addDays(toDate(gestationStart), 294).toISOString().slice(0, 10) : null);
  const puerperiumStart = summary?.puerperiumStart || gestationEnd;
  const puerperiumEnd = summary?.puerperiumEnd || (puerperiumStart && isValidDateValue(puerperiumStart) ? addDays(toDate(puerperiumStart), 42).toISOString().slice(0, 10) : null);
  const firstConsultLimit = gestationStart && isValidDateValue(gestationStart) ? addWeeks(toDate(gestationStart), 12).toISOString().slice(0, 10) : null;
  const dtpaLimit = gestationEnd;
  const firstTrimesterEnd = gestationStart && isValidDateValue(gestationStart) ? addWeeks(toDate(gestationStart), 13).toISOString().slice(0, 10) : null;
  const thirdTrimesterStart = gestationStart && isValidDateValue(gestationStart) ? addWeeks(toDate(gestationStart), 28).toISOString().slice(0, 10) : null;

  const attendanceRows = (evidence.attendanceRowsByCitizen.get(citizenId) ?? []).filter((entry) => isValidDateValue(entry.event_date?.slice(0, 10)));
  const procedureRows = (evidence.procedureRowsByCitizen.get(citizenId) ?? []).filter((entry) => isValidDateValue(entry.event_date?.slice(0, 10)));
  const visitRows = (evidence.visitRowsByCitizen.get(citizenId) ?? []).filter((entry) => isValidDateValue(entry.event_date?.slice(0, 10)));
  const vaccineRows = (evidence.vaccineRowsByCitizen.get(citizenId) ?? []).filter((entry) => isValidDateValue(entry.event_date?.slice(0, 10)));

  const prenatalAttendanceEvents = attendanceRows
    .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd))
    .flatMap((entry) => buildMedicalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2));

  const prenatalProcedureEvents = procedureRows
    .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd) && includesProcedure(entry, CONSULTATION_CODES))
    .flatMap((entry) => buildMedicalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2));

  const prenatalConsultationEvents = dedupeEvents([...prenatalAttendanceEvents, ...prenatalProcedureEvents]);
  const prenatalConsultationDates = distinctDates(prenatalConsultationEvents);
  const firstPrenatalDate = prenatalConsultationDates[0] || null;
  const firstPrenatalWeek = firstPrenatalDate && gestationStart && isValidDateValue(firstPrenatalDate) && isValidDateValue(gestationStart)
    ? Math.max(0, Math.ceil(diffInDays(toDate(gestationStart), toDate(firstPrenatalDate)) / 7))
    : null;

  const pressureEvents = dedupeEvents(
    procedureRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd) && includesProcedure(entry, PRESSURE_CODES))
      .flatMap((entry) => buildQualifiedEvents(entry.event_date.slice(0, 10), [
        { professional: entry.professional1, eligible: normalizeCode(entry.proc_a) === PRESSURE_CODES[0] && isNamedProfessional(entry.professional1) },
        { professional: entry.professional2, eligible: normalizeCode(entry.proc_s) === PRESSURE_CODES[0] && isNamedProfessional(entry.professional2) },
        { professional: entry.professional1, eligible: normalizeCode(entry.proc_s) === PRESSURE_CODES[0] && isMedicalCbo(entry.cbo1) },
        { professional: entry.professional2, eligible: normalizeCode(entry.proc_a) === PRESSURE_CODES[0] && isMedicalCbo(entry.cbo2) },
      ])),
  );
  const pressureDates = distinctDates(pressureEvents);

  const groupedAnthropometry = new Map<string, { hasAssessment: boolean; hasWeight: boolean; hasHeight: boolean; events: IndicatorProcedureEvent[] }>();
  for (const entry of procedureRows.filter((candidate) => withinRange(candidate.event_date.slice(0, 10), gestationStart, gestationEnd))) {
    const date = entry.event_date.slice(0, 10);
    const current = groupedAnthropometry.get(date) ?? { hasAssessment: false, hasWeight: false, hasHeight: false, events: [] };
    const codes = [normalizeCode(entry.proc_a), normalizeCode(entry.proc_s)].filter(Boolean);
    current.hasAssessment ||= codes.includes(ANTHROPOMETRY_ASSESSMENT_CODE);
    current.hasWeight ||= codes.includes(WEIGHT_CODE);
    current.hasHeight ||= codes.includes(HEIGHT_CODE);
    current.events.push(...buildQualifiedEvents(date, [
      { professional: entry.professional1, eligible: isNamedProfessional(entry.professional1) && codes.length > 0 },
      { professional: entry.professional2, eligible: isNamedProfessional(entry.professional2) && codes.length > 0 },
    ]));
    groupedAnthropometry.set(date, current);
  }
  const anthropometryEvents = dedupeEvents(
    [...groupedAnthropometry.entries()]
      .filter(([, value]) => (value.hasAssessment || (value.hasWeight && value.hasHeight)) && value.events.length > 0)
      .flatMap(([, value]) => value.events),
  );
  const anthropometryDates = distinctDates(anthropometryEvents);
  const anthropometryRecords = [
    ...attendanceRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd))
      .filter((entry) => entry.weight !== null && entry.weight !== undefined && entry.height !== null && entry.height !== undefined)
      .map((entry) => ({
        date: entry.event_date.slice(0, 10),
        weight: entry.weight ?? null,
        height: entry.height ?? null,
      })),
    ...visitRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd))
      .filter((entry) => entry.weight !== null && entry.weight !== undefined && entry.height !== null && entry.height !== undefined)
      .map((entry) => ({
        date: entry.event_date.slice(0, 10),
        weight: entry.weight ?? null,
        height: entry.height ?? null,
      })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((record, index, records) => records.findIndex((candidate) => candidate.date === record.date) === index)
    .slice(0, 2);

  const acsVisitEvents = dedupeEvents(
    visitRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), firstPrenatalDate || gestationStart, gestationEnd))
      .flatMap((entry) => buildAcsEvents(entry.event_date.slice(0, 10), entry.cbo, entry.professional)),
  );
  const acsVisitDates = distinctDates(acsVisitEvents);

  const dtpaEvents = dedupeEvents(
    vaccineRows
      .filter((entry) => {
        const date = entry.event_date.slice(0, 10);
        if (!withinRange(date, gestationStart, gestationEnd)) return false;
        if (!DTPA_CODES.includes(normalizeCode(entry.vaccine_code))) return false;
        if (gestationStart && isValidDateValue(gestationStart) && diffInDays(toDate(gestationStart), toDate(date)) < 140) return false;
        return isNamedProfessional(entry.professional);
      })
      .flatMap((entry) => buildQualifiedEvents(entry.event_date.slice(0, 10), [{ professional: entry.professional, eligible: true }])),
  );
  const dtpaDate = distinctDates(dtpaEvents)[0] ?? null;

  const collectGroupedTestEvents = (groups: Record<string, string[]>, start: string | null, end: string | null) => {
    const entries = Object.entries(groups).map(([groupKey, codes]) => {
      const events = dedupeEvents(
        procedureRows
          .filter((entry) => withinRange(entry.event_date.slice(0, 10), start, end) && includesProcedure(entry, codes))
          .flatMap((entry) => buildQualifiedEvents(entry.event_date.slice(0, 10), [
            { professional: entry.professional1, eligible: isNamedProfessional(entry.professional1) && Boolean(normalizeCode(entry.proc_a) && codes.includes(normalizeCode(entry.proc_a))) },
            { professional: entry.professional2, eligible: isNamedProfessional(entry.professional2) && Boolean(normalizeCode(entry.proc_s) && codes.includes(normalizeCode(entry.proc_s))) },
            { professional: entry.professional1, eligible: isMedicalCbo(entry.cbo1) && Boolean(normalizeCode(entry.proc_s) && codes.includes(normalizeCode(entry.proc_s))) },
            { professional: entry.professional2, eligible: isMedicalCbo(entry.cbo2) && Boolean(normalizeCode(entry.proc_a) && codes.includes(normalizeCode(entry.proc_a))) },
          ])),
      );
      return { groupKey, events };
    });
    return {
      completed: entries.every((entry) => entry.events.length > 0),
      completedGroups: entries.filter((entry) => entry.events.length > 0).length,
      totalGroups: entries.length,
      events: dedupeEvents(entries.flatMap((entry) => entry.events.slice(0, 1))),
    };
  };

  const firstTrimesterTests = collectGroupedTestEvents(FIRST_TRIMESTER_GROUPS, gestationStart, firstTrimesterEnd);
  const thirdTrimesterTests = collectGroupedTestEvents(THIRD_TRIMESTER_GROUPS, thirdTrimesterStart, gestationEnd);

  const puerperalConsultAttendanceEvents = attendanceRows
    .filter((entry) => withinRange(entry.event_date.slice(0, 10), puerperiumStart, puerperiumEnd))
    .flatMap((entry) => buildMedicalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2));
  const puerperalConsultProcedureEvents = procedureRows
    .filter((entry) => withinRange(entry.event_date.slice(0, 10), puerperiumStart, puerperiumEnd) && includesProcedure(entry, ["0301010129"]))
    .flatMap((entry) => buildMedicalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2));
  const puerperalConsultationEvents = dedupeEvents([...puerperalConsultAttendanceEvents, ...puerperalConsultProcedureEvents]);
  const puerperalConsultationDate = distinctDates(puerperalConsultationEvents)[0] ?? null;

  const puerperalVisitEvents = dedupeEvents(
    visitRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), puerperiumStart, puerperiumEnd))
      .flatMap((entry) => buildAcsEvents(entry.event_date.slice(0, 10), entry.cbo, entry.professional)),
  );
  const puerperalVisitDate = distinctDates(puerperalVisitEvents)[0] ?? null;

  const oralHealthEvents = dedupeEvents([
    ...attendanceRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd))
      .flatMap((entry) => buildDentalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2)),
    ...procedureRows
      .filter((entry) => withinRange(entry.event_date.slice(0, 10), gestationStart, gestationEnd))
      .flatMap((entry) => buildDentalEvents(entry.event_date.slice(0, 10), entry.cbo1, entry.professional1, entry.cbo2, entry.professional2)),
  ]);
  const oralHealthDate = distinctDates(oralHealthEvents)[0] ?? null;

  const flags: IndicatorFlag[] = [
    makeFlag(
      "A",
      "1ª consulta até 12 semanas",
      Boolean(firstPrenatalDate && firstPrenatalWeek !== null && firstPrenatalWeek <= 12),
      firstPrenatalDate ? `${firstPrenatalWeek ?? "?"}ª semana` : "Sem registro",
      firstPrenatalDate ? `Primeira consulta localizada em ${firstPrenatalDate}.` : "Primeira consulta pré-natal não localizada na base.",
      "Consulta por médica(o) ou enfermeira(o) até a 12ª semana, conforme a nota metodológica do C3.",
      firstConsultLimit,
      true,
      firstPrenatalDate ? prenatalConsultationEvents.filter((event) => event.date === firstPrenatalDate) : [],
    ),
    makeFlag(
      "B",
      "07 consultas na gestação",
      prenatalConsultationDates.length >= 7,
      `${prenatalConsultationDates.length}/7 consultas`,
      `${prenatalConsultationDates.length} consulta(s) pré-natal identificada(s) na base durante a gestação.`,
      "Consultas presenciais ou remotas por médica(o) ou enfermeira(o) durante a gestação.",
      gestationEnd,
      true,
      prenatalConsultationEvents,
    ),
    makeFlag(
      "C",
      "07 aferições de pressão arterial",
      pressureDates.length >= 7,
      `${pressureDates.length}/7 aferições`,
      `${pressureDates.length} aferição(ões) de pressão arterial identificada(s) na base.`,
      "Procedimento 03.01.10.003-9 durante a gestação.",
      gestationEnd,
      true,
      pressureEvents,
    ),
    makeFlag(
      "D",
      "07 registros simultâneos de peso e altura",
      anthropometryDates.length >= 7,
      `${anthropometryDates.length}/7 registros`,
      `${anthropometryDates.length} data(s) com antropometria válida identificada(s).`,
      "Avaliação antropométrica ou combinação simultânea de peso e altura durante a gestação.",
      gestationEnd,
      true,
      anthropometryEvents,
    ),
    makeFlag(
      "E",
      "03 visitas domiciliares por ACS/TACS",
      acsVisitDates.length >= 3,
      `${acsVisitDates.length}/3 visitas`,
      `${acsVisitDates.length} visita(s) domiciliar(es) por ACS/TACS localizada(s) após a primeira consulta.`,
      "Visitas domiciliares por ACS/TACS durante a gestação, após a primeira consulta pré-natal.",
      gestationEnd,
      true,
      acsVisitEvents,
    ),
    makeFlag(
      "F",
      "Vacina dTpa após 20 semanas",
      Boolean(dtpaDate),
      dtpaDate ? `Aplicada em ${dtpaDate}` : "Sem registro",
      dtpaDate ? `Vacina dTpa localizada em ${dtpaDate}.` : "Vacina dTpa adulto não localizada a partir da 20ª semana.",
      "Imunobiológico 57 (dTpa adulto) a partir da 20ª semana da gestação.",
      dtpaLimit,
      true,
      dtpaEvents,
    ),
    makeFlag(
      "G",
      "Testes do 1º trimestre",
      firstTrimesterTests.completed,
      `${firstTrimesterTests.completedGroups}/${firstTrimesterTests.totalGroups} grupos`,
      firstTrimesterTests.completed ? "Sífilis, HIV, hepatites B e C localizados no 1º trimestre." : "Nem todos os grupos de exames do 1º trimestre foram localizados.",
      "Exige registro de sífilis, HIV, hepatite B e hepatite C no 1º trimestre.",
      firstTrimesterEnd || gestationEnd,
      true,
      firstTrimesterTests.events,
    ),
    makeFlag(
      "H",
      "Testes do 3º trimestre",
      thirdTrimesterTests.completed,
      `${thirdTrimesterTests.completedGroups}/${thirdTrimesterTests.totalGroups} grupos`,
      thirdTrimesterTests.completed ? "Sífilis e HIV localizados no 3º trimestre." : "Nem todos os grupos de exames do 3º trimestre foram localizados.",
      "Exige registro de sífilis e HIV no 3º trimestre.",
      gestationEnd,
      true,
      thirdTrimesterTests.events,
    ),
    makeFlag(
      "I",
      "Consulta no puerpério",
      Boolean(puerperalConsultationDate),
      puerperalConsultationDate ? `Consulta em ${puerperalConsultationDate}` : "Sem registro",
      puerperalConsultationDate ? "Consulta puerperal localizada na base." : "Consulta puerperal não localizada na base.",
      "Ao menos uma consulta presencial ou remota durante o puerpério.",
      puerperiumEnd,
      true,
      puerperalConsultationDate ? puerperalConsultationEvents.filter((event) => event.date === puerperalConsultationDate) : [],
    ),
    makeFlag(
      "J",
      "Visita domiciliar no puerpério",
      Boolean(puerperalVisitDate),
      puerperalVisitDate ? `Visita em ${puerperalVisitDate}` : "Sem registro",
      puerperalVisitDate ? "Visita domiciliar puerperal localizada na base." : "Visita domiciliar puerperal não localizada na base.",
      "Ao menos uma visita domiciliar por ACS/TACS durante o puerpério.",
      puerperiumEnd,
      true,
      puerperalVisitEvents,
    ),
    makeFlag(
      "K",
      "Atividade de saúde bucal",
      Boolean(oralHealthDate),
      oralHealthDate ? `Registro em ${oralHealthDate}` : "Sem registro",
      oralHealthDate ? "Atividade/consulta de saúde bucal localizada na base." : "Atividade de saúde bucal não localizada na base durante a gestação.",
      "Ao menos uma atividade em saúde bucal realizada por cirurgiã(ão)-dentista ou equipe de saúde bucal na gestação.",
      gestationEnd,
      true,
      oralHealthEvents,
    ),
  ];

  const totalPoints = flags.reduce((sum, flag) => sum + flag.earnedPoints, 0);
  const completedFlags = flags.filter((flag) => flag.status === "done").length;
  const pendingFlags = flags.filter((flag) => flag.status === "attention").length;
  const trackingFlags = flags.filter((flag) => flag.status === "tracking").length;
  const birthDate = normalizeDateValue(match.nascimento || row.nascimento);

  return {
    index: row.index,
    nome: match.nome || row.nome || "Paciente sem nome",
    cpf: normalizeDigits(match.cpf || row.cpf),
    cns: normalizeDigits(match.cns || row.cns),
    nascimento: birthDate,
    sexo: match.sexo || row.sexo || "",
    unidade: match.unidade || row.unidade || "",
    equipe: match.equipe || row.equipe || "",
    idadeEmMeses: birthDate && isValidDateValue(birthDate) ? diffInMonths(toDate(birthDate), now) : 0,
    totalPoints,
    classification: getClassification(totalPoints),
    completedFlags,
    pendingFlags,
    trackingFlags,
    flags,
    anthropometryRecords,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? (body.rows as PatientInput[]) : [];

    const externalHost = Deno.env.get("EXTERNAL_DB_HOST");
    const externalPort = Number(Deno.env.get("EXTERNAL_DB_PORT") || "5432");
    const externalDatabase = Deno.env.get("EXTERNAL_DB_NAME");
    const externalUser = Deno.env.get("EXTERNAL_DB_USER");
    const externalPassword = Deno.env.get("EXTERNAL_DB_PASSWORD");

    if (!rows.length) {
      return new Response(JSON.stringify({ success: true, patients: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!externalHost || !externalDatabase || !externalUser || !externalPassword) {
      throw new Error("Credenciais do banco externo não configuradas para o C3.");
    }

    const client = new Client({
      host: externalHost,
      port: externalPort,
      database: externalDatabase,
      user: externalUser,
      password: externalPassword,
      ssl: false,
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      const matchesByRow = await queryCitizenMatches(client, rows);
      const citizenIds = [...new Set([...matchesByRow.values()].filter(Boolean).map((match) => (match as CitizenMatch).citizenId))];
      const [summaryRowsByCitizen, evidence] = await Promise.all([querySummaryRows(client, citizenIds), queryEvidence(client, citizenIds)]);

      const patients = rows.map((row) => {
        const match = matchesByRow.get(`${row.index}`);
        if (!match) return buildFallbackPatient(row);
        return buildMatchedPatient(row, match, summaryRowsByCitizen.get(match.citizenId), evidence);
      });

      return new Response(JSON.stringify({ success: true, patients }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (error) {
    console.error("c3-gestation-indicator fatal", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Falha ao calcular o indicador C3.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});