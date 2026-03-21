import { Client } from "npm:pg@8.16.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IndicatorFlagKey = "A" | "B" | "C" | "D" | "E";
type IndicatorFlagStatus = "done" | "attention" | "tracking";

type PatientInput = {
  index: number;
  cpf?: string;
  cns?: string;
  nome?: string;
  nascimento?: string;
  sexo?: string;
  unidade?: string;
  equipe?: string;
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

type IndicatorProcedureEvent = {
  date: string;
  professional: string;
};

type IndicatorFlag = {
  key: IndicatorFlagKey;
  title: string;
  status: IndicatorFlagStatus;
  completed: boolean;
  points: number;
  detail: string;
  deadline?: {
    date: string;
    label: string;
  } | null;
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

type ProcedureRow = {
  citizen_id: number;
  event_date: string;
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
  st_acomp_recem_nascido?: number | null;
  st_acomp_crianca?: number | null;
  has_both?: boolean;
  weight?: number | null;
  height?: number | null;
};

type VaccineRow = {
  citizen_id: number;
  event_date: string;
  vaccine_code: string | null;
  professional?: string | null;
};

const MEDICAL_CBO_PREFIXES = ["2231", "2235", "2251", "2252", "2253"];
const ACS_CBO_CODES = ["515105", "322255"];
const PRIMARY_DTP_HEPB_HIB_CODES = ["9", "17", "29", "39", "42", "43", "46", "47", "58"];
const VIP_CODES = ["22", "29", "43", "58"];
const SCR_CODES = ["24", "56"];
const PNEUMO_CODES = ["26", "59", "106", "107"];

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

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};

const addYears = (date: Date, years: number) => {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const isValidDate = (value: Date) => !Number.isNaN(value.getTime());
const isValidDateValue = (value: string | null | undefined) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidDate(toDate(value));
};
const formatDate = (value: string | null | undefined) => (isValidDateValue(value) ? toDate(value).toLocaleDateString("pt-BR") : "-");
const clampDate = (value: Date, max: Date) => (value.getTime() > max.getTime() ? max : value);
const daysBetween = (start: Date, end: Date) => Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
const monthsBetween = (start: Date, end: Date) => Math.max(0, Math.floor(daysBetween(start, end) / 30.4375));

const normalizeCbo = (value: string | null | undefined) => normalizeDigits(value);
const normalizeProfessionalName = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();
const isNamedProfessional = (value: string | null | undefined) => {
  const normalized = normalizeProfessionalName(value);
  if (!normalized) return false;

  const comparable = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return comparable !== "NAO INFORMADO";
};
const isMedicalCbo = (value: string | null | undefined) => MEDICAL_CBO_PREFIXES.some((prefix) => normalizeCbo(value).startsWith(prefix));
const isAcsCbo = (value: string | null | undefined) => ACS_CBO_CODES.includes(normalizeCbo(value));
const toDistinctSortedDates = (values: string[]) => [...new Set(values)].sort();
const listFormatter = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });
const buildProcedureEventKey = (event: IndicatorProcedureEvent) => `${event.date}|${event.professional}`;
const dedupeProcedureEvents = (events: IndicatorProcedureEvent[]) => {
  const unique = new Map<string, IndicatorProcedureEvent>();

  for (const event of events) {
    if (!isValidDateValue(event.date) || !isNamedProfessional(event.professional)) continue;
    const normalized = {
      date: event.date.slice(0, 10),
      professional: normalizeProfessionalName(event.professional),
    };

    unique.set(buildProcedureEventKey(normalized), normalized);
  }

  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) || a.professional.localeCompare(b.professional, "pt-BR"));
};
const buildEventsFromProfessionals = (date: string, professionals: Array<string | null | undefined>) => {
  const normalizedProfessionals = [...new Set(professionals.map(normalizeProfessionalName).filter(isNamedProfessional))];
  return normalizedProfessionals.map((professional) => ({ date, professional }));
};
const collectQualifiedDates = (events: IndicatorProcedureEvent[]) => toDistinctSortedDates(dedupeProcedureEvents(events).map((event) => event.date));

const getClassification = (points: number): IndicatorPatient["classification"] => {
  if (points > 75) return "otimo";
  if (points > 50) return "bom";
  if (points > 25) return "suficiente";
  return "regular";
};

const makeFlag = (
  key: IndicatorFlagKey,
  title: string,
  completed: boolean,
  detail: string,
  dueDate: Date,
  now: Date,
  deadlineLabel = "Data limite para registro",
): IndicatorFlag => {
  const status: IndicatorFlagStatus = completed ? "done" : now.getTime() <= dueDate.getTime() ? "tracking" : "attention";
  return {
    key,
    title,
    status,
    completed,
    points: 20,
    detail,
    deadline: {
      date: dueDate.toISOString().slice(0, 10),
      label: deadlineLabel,
    },
  };
};

const upsertUnique = (map: Map<string, CitizenMatch | "AMBIGUOUS">, key: string, match: CitizenMatch) => {
  if (!key) return;
  const current = map.get(key);
  if (!current) {
    map.set(key, match);
    return;
  }

  if (current !== "AMBIGUOUS" && current.citizenId !== match.citizenId) {
    map.set(key, "AMBIGUOUS");
  }
};

const getUnique = (value: CitizenMatch | "AMBIGUOUS" | undefined) => {
  if (!value || value === "AMBIGUOUS") return null;
  return value;
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
    return new Response(JSON.stringify({ success: false, error: "Nenhum paciente foi enviado para cálculo do indicador." }), {
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

    const mapCitizenRow = (row: Record<string, string | number | null>): CitizenMatch => ({
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
      const cpfResult = await client.query(citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cpf_cidadao, ''), '\\D', '', 'g') = any($1::text[])"), [cpfList]);
      for (const row of cpfResult.rows) {
        const match = mapCitizenRow(row);
        cpfMap.set(String(row.normalized_cpf), match);
      }
    }

    if (cnsList.length > 0) {
      const cnsResult = await client.query(citizenBaseQuery.replace("%FILTER%", "regexp_replace(coalesce(p.nu_cns, ''), '\\D', '', 'g') = any($1::text[])"), [cnsList]);
      for (const row of cnsResult.rows) {
        const match = mapCitizenRow(row);
        cnsMap.set(String(row.normalized_cns), match);
      }
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

      const nameBirthResult = await client.query(citizenBaseQuery.replace("%FILTER%", conditions.join(" or ")), params);
      for (const row of nameBirthResult.rows) {
        const match = mapCitizenRow(row);
        const name = row.normalized_name ? String(row.normalized_name) : "";
        const birth = match.nascimento ? normalizeDateValue(match.nascimento) : "";
        if (name && birth) upsertUnique(nameBirthMap, `${name}|${birth}`, match);
        upsertUnique(nameMap, name, match);
        upsertUnique(birthMap, birth, match);
      }
    }

    const patientsWithMatch = rows
      .map((row) => {
        const cpf = normalizeDigits(row.cpf);
        const cns = normalizeDigits(row.cns);
        const nome = normalizeName(row.nome);
        const nascimento = normalizeDateValue(row.nascimento);
        const match =
          (cpf ? cpfMap.get(cpf) ?? null : null) ??
          (cns ? cnsMap.get(cns) ?? null : null) ??
          (nome && nascimento ? getUnique(nameBirthMap.get(`${nome}|${nascimento}`)) : null) ??
          (nome ? getUnique(nameMap.get(nome)) : null) ??
          (nascimento ? getUnique(birthMap.get(nascimento)) : null);

        return match
          ? {
              row,
              match,
            }
          : null;
      })
      .filter(Boolean) as Array<{ row: PatientInput; match: CitizenMatch }>;

    if (!patientsWithMatch.length) {
      return new Response(JSON.stringify({ success: true, patients: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const citizenIds = [...new Set(patientsWithMatch.map(({ match }) => match.citizenId))];

    const [consultationResult, anthropometryAttendanceResult, anthropometryVisitResult, procedureResult, visitResult, vaccineResult] = await Promise.all([
      client.query(
        `
          select
            ai.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            cbo1.nu_cbo as cbo1,
            cbo2.nu_cbo as cbo2,
            prof1.no_profissional as professional1,
            prof2.no_profissional as professional2
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
            ai.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            prof1.no_profissional as professional1,
            prof2.no_profissional as professional2,
            ai.nu_peso as weight,
            ai.nu_altura as height
          from public.tb_fat_atendimento_individual ai
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = ai.co_dim_tempo
          left join public.tb_dim_profissional prof1 on prof1.co_seq_dim_profissional = ai.co_dim_profissional_1
          left join public.tb_dim_profissional prof2 on prof2.co_seq_dim_profissional = ai.co_dim_profissional_2
          where ai.co_fat_cidadao_pec = any($1::bigint[])
            and ai.nu_peso is not null
            and ai.nu_altura is not null
        `,
        [citizenIds],
      ),
      client.query(
        `
          select
            v.co_fat_cidadao_pec as citizen_id,
            t.dt_registro::text as event_date,
            prof.no_profissional as professional,
            v.nu_peso as weight,
            v.nu_altura as height
          from public.tb_fat_visita_domiciliar v
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = v.co_dim_tempo
          left join public.tb_dim_profissional prof on prof.co_seq_dim_profissional = v.co_dim_profissional
          where v.co_fat_cidadao_pec = any($1::bigint[])
            and v.nu_peso is not null
            and v.nu_altura is not null
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
            prof1.no_profissional as professional1,
            prof2.no_profissional as professional2
          from public.tb_fat_atd_ind_procedimentos p
          join public.tb_dim_tempo t on t.co_seq_dim_tempo = p.co_dim_tempo
          left join public.tb_dim_procedimento pa on pa.co_seq_dim_procedimento = p.co_dim_procedimento_avaliado
          left join public.tb_dim_procedimento ps on ps.co_seq_dim_procedimento = p.co_dim_procedimento_solicitado
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
            v.st_acomp_recem_nascido,
            v.st_acomp_crianca,
            (v.nu_peso is not null and v.nu_altura is not null) as has_both
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

    const consultationsByCitizen = new Map<number, EventRow[]>();
    for (const row of consultationResult.rows as EventRow[]) {
      const list = consultationsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      consultationsByCitizen.set(Number(row.citizen_id), list);
    }

    const anthropometryAttendanceRowsByCitizen = new Map<number, EventRow[]>();
    for (const row of anthropometryAttendanceResult.rows as EventRow[]) {
      const list = anthropometryAttendanceRowsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      anthropometryAttendanceRowsByCitizen.set(Number(row.citizen_id), list);
    }

    const anthropometryVisitRowsByCitizen = new Map<number, VisitRow[]>();
    for (const row of anthropometryVisitResult.rows as VisitRow[]) {
      const list = anthropometryVisitRowsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      anthropometryVisitRowsByCitizen.set(Number(row.citizen_id), list);
    }

    const procedureRowsByCitizen = new Map<number, ProcedureRow[]>();
    for (const row of procedureResult.rows as ProcedureRow[]) {
      const list = procedureRowsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      procedureRowsByCitizen.set(Number(row.citizen_id), list);
    }

    const visitRowsByCitizen = new Map<number, VisitRow[]>();
    for (const row of visitResult.rows as VisitRow[]) {
      const list = visitRowsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      visitRowsByCitizen.set(Number(row.citizen_id), list);
    }

    const vaccineRowsByCitizen = new Map<number, VaccineRow[]>();
    for (const row of vaccineResult.rows as VaccineRow[]) {
      const list = vaccineRowsByCitizen.get(Number(row.citizen_id)) ?? [];
      list.push(row);
      vaccineRowsByCitizen.set(Number(row.citizen_id), list);
    }

    const today = new Date();

    const patients: IndicatorPatient[] = patientsWithMatch.flatMap(({ row, match }) => {
      const birthIso = normalizeDateValue(match.nascimento ?? row.nascimento);
      if (!isValidDateValue(birthIso)) {
        return [];
      }

      const birthDate = toDate(birthIso);
      const due30Days = addDays(birthDate, 30);
      const due6Months = addMonths(birthDate, 6);
      const due12Months = addMonths(birthDate, 12);
      const due24Months = addYears(birthDate, 2);
      const evaluationEnd = clampDate(today, due24Months);
      const citizenId = match.citizenId;

      // Denominator: children up to 2 years (24 months)
      const monthsOld = monthsBetween(birthDate, today);
      if (monthsOld > 24) {
        return [];
      }

      const consultationRows = (consultationsByCitizen.get(citizenId) ?? []).filter((event) => {
        if (!(isMedicalCbo(event.cbo1) || isMedicalCbo(event.cbo2))) return false;
        const date = event.event_date.slice(0, 10);
        if (!isValidDateValue(date)) return false;
        const eventDate = toDate(date);
        return eventDate.getTime() >= birthDate.getTime() && eventDate.getTime() <= evaluationEnd.getTime();
      });

      // User rule: also include teleconsultation 0301010250 from procedures
      const teleConsultRows = (procedureRowsByCitizen.get(citizenId) ?? []).filter((row) => {
        const date = row.event_date.slice(0, 10);
        if (!isValidDateValue(date)) return false;
        const eventDate = toDate(date);
        const codes = [normalizeDigits(row.proc_a), normalizeDigits(row.proc_s)];
        return codes.includes("0301010250") &&
               eventDate.getTime() >= birthDate.getTime() && 
               eventDate.getTime() <= evaluationEnd.getTime();
      });

      const consultationEvents = dedupeProcedureEvents([
        ...consultationRows.flatMap((event) =>
          buildEventsFromProfessionals(event.event_date.slice(0, 10), [event.professional1, event.professional2]),
        ),
        ...teleConsultRows.flatMap((row) =>
          buildEventsFromProfessionals(row.event_date.slice(0, 10), [row.professional1, row.professional2]),
        )
      ]);
      const consultationDates = collectQualifiedDates(consultationEvents);

      const firstConsultDate = consultationDates[0] ?? null;
      const completedA = Boolean(firstConsultDate && toDate(firstConsultDate).getTime() <= due30Days.getTime());
      const flagA = makeFlag(
        "A",
        "1ª consulta até 30 dias",
        completedA,
        `Primeira consulta: ${formatDate(firstConsultDate)}. Prazo: ${formatDate(due30Days.toISOString().slice(0, 10))}.`,
        due30Days,
        today,
      );

      const completedB = consultationDates.length >= 9;
      const flagB = makeFlag(
        "B",
        "9 consultas até 2 anos",
        completedB,
        consultationDates.length
          ? `Datas: ${listFormatter.format(consultationDates.slice(0, 5).map(formatDate))}${consultationDates.length > 5 ? "…" : ""}`
          : "Nenhuma consulta localizada.",
        due24Months,
        today,
      );

      const anthropometryDateMap = new Map<string, { date: string; professional: string }[]>();
      const appendAnthropometryEvents = (date: string, professionals: string[]) => {
        const normalizedDate = date.slice(0, 10);
        if (!isValidDateValue(normalizedDate)) return;
        const eventDate = toDate(normalizedDate);
        if (eventDate.getTime() < birthDate.getTime() || eventDate.getTime() > evaluationEnd.getTime()) return;
        const current = anthropometryDateMap.get(normalizedDate) ?? [];
        professionals.forEach(p => current.push({ date: normalizedDate, professional: p }));
        anthropometryDateMap.set(normalizedDate, current);
      };

      for (const row of anthropometryAttendanceRowsByCitizen.get(citizenId) ?? []) {
        appendAnthropometryEvents(row.event_date, [row.professional1 || "", row.professional2 || ""].filter(isNamedProfessional));
      }
      for (const row of anthropometryVisitRowsByCitizen.get(citizenId) ?? []) {
        appendAnthropometryEvents(row.event_date, [row.professional || ""].filter(isNamedProfessional));
      }
      for (const row of procedureRowsByCitizen.get(citizenId) ?? []) {
        const codes = [normalizeDigits(row.proc_a), normalizeDigits(row.proc_s)];
        if (codes.includes("0101040024") || codes.includes("0301010269") || (codes.includes("0101040083") && codes.includes("0101040075"))) {
          appendAnthropometryEvents(row.event_date, [row.professional1 || "", row.professional2 || ""].filter(isNamedProfessional));
        }
      }

      const anthropometryDates = [...anthropometryDateMap.keys()].sort();
      const completedC = anthropometryDates.length >= 9;
      const flagC = makeFlag(
        "C",
        "9 registros de peso e altura",
        completedC,
        anthropometryDates.length
          ? `Registros: ${listFormatter.format(anthropometryDates.slice(0, 5).map(formatDate))}${anthropometryDates.length > 5 ? "…" : ""}`
          : "Nenhum registro localizado.",
        due24Months,
        today,
      );

      const anthropometryRecords = [
        ...(anthropometryAttendanceRowsByCitizen.get(citizenId) ?? []).map(r => ({ date: r.event_date.slice(0, 10), weight: r.weight ?? null, height: r.height ?? null })),
        ...(anthropometryVisitRowsByCitizen.get(citizenId) ?? []).map(r => ({ date: r.event_date.slice(0, 10), weight: r.weight ?? null, height: r.height ?? null })),
      ].filter(r => isValidDateValue(r.date)).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 2);

      const visitDates = collectQualifiedDates((visitRowsByCitizen.get(citizenId) ?? [])
        .filter(v => isAcsCbo(v.cbo) && (v.st_acomp_recem_nascido === 1 || v.st_acomp_crianca === 1))
        .flatMap(v => buildEventsFromProfessionals(v.event_date.slice(0, 10), [v.professional])));

      const firstVisitInWindow = visitDates[0] ?? null;
      const completedD = Boolean(firstVisitInWindow && toDate(firstVisitInWindow).getTime() <= due30Days.getTime() && visitDates.length >= 2);
      const flagD = makeFlag(
        "D",
        "2 visitas ACS/TACS",
        completedD,
        firstVisitInWindow
          ? `Primeira visita em ${formatDate(firstVisitInWindow)}. Meta até ${formatDate(due6Months.toISOString().slice(0, 10))}.`
          : "Nenhuma visita localizada.",
        due6Months,
        today,
      );

      const vaccineRowsWithProfessional = (vaccineRowsByCitizen.get(citizenId) ?? []).filter(v => isNamedProfessional(v.professional));
      const countDistinctDatesByCodes = (codes: string[], minDate?: Date) =>
        toDistinctSortedDates(vaccineRowsWithProfessional
          .filter(v => codes.includes(String(v.vaccine_code ?? "")))
          .filter(v => !minDate || toDate(v.event_date.slice(0, 10)).getTime() >= minDate.getTime())
          .map(v => v.event_date.slice(0, 10))).length;

      const primaryCount = countDistinctDatesByCodes(PRIMARY_DTP_HEPB_HIB_CODES);
      const vipCount = countDistinctDatesByCodes(VIP_CODES);
      const scrCount = countDistinctDatesByCodes(SCR_CODES, due12Months);
      const pneumoCount = countDistinctDatesByCodes(PNEUMO_CODES);
      const completedE = primaryCount >= 3 && vipCount >= 3 && scrCount >= 2 && pneumoCount >= 2;
      const flagE = makeFlag(
        "E",
        "Vacinação completa",
        completedE,
        `DTP/HepB/Hib ${primaryCount}/3 · VIP ${vipCount}/3 · SCR ${scrCount}/2 · Pneumo ${pneumoCount}/2`,
        due24Months,
        today,
      );

      const flags = [flagA, flagB, flagC, flagD, flagE];
      const totalPoints = flags.reduce((sum, flag) => sum + (flag.completed ? flag.points : 0), 0);

      return [{
        index: row.index,
        nome: match.nome ?? row.nome ?? "Sem nome",
        cpf: match.cpf ?? row.cpf ?? "",
        cns: match.cns ?? row.cns ?? "",
        nascimento: birthIso,
        sexo: match.sexo ?? row.sexo ?? "",
        unidade: match.unidade ?? row.unidade ?? "",
        equipe: match.equipe ?? row.equipe ?? "",
        idadeEmMeses: monthsOld,
        totalPoints,
        classification: getClassification(totalPoints),
        completedFlags: flags.filter((flag) => flag.status === "done").length,
        pendingFlags: flags.filter((flag) => flag.status === "attention").length,
        trackingFlags: flags.filter((flag) => flag.status === "tracking").length,
        flags,
        anthropometryRecords,
      }];
    });

    patients.sort((a, b) => a.totalPoints - b.totalPoints || b.pendingFlags - a.pendingFlags || a.nome.localeCompare(b.nome));

    return new Response(JSON.stringify({ success: true, patients }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Falha ao calcular o indicador infantil.",
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
