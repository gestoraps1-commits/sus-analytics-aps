import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_OWNER_ID = "00000000-0000-0000-0000-000000000000";
const C2_INDICATOR_CODE = "c2_development_child";
const C3_INDICATOR_CODE = "c3_gestation_puerperium";
const PAGE_SIZE = 1000;

type UploadMode = "citizen" | "professional";
type SearchSource = "cpf" | "cns" | "nome_data_nascimento" | "nome" | "data_nascimento" | null;
type ParsedRow = Record<string, string>;

type ParsedSheet = {
  name: string;
  columns: string[];
  rows: ParsedRow[];
  mode: UploadMode;
};

type SearchResult = {
  index: number;
  found: boolean;
  source: SearchSource;
  backend: Record<string, unknown> | null;
};

type IndicatorProcedureEvent = {
  date: string;
  professional: string;
};

type IndicatorFlag = {
  key: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";
  title: string;
  status: "done" | "attention" | "tracking";
  completed: boolean;
  points: number;
  earnedPoints: number;
  metric: string;
  summary: string;
  detail: string;
  deadline?: {
    date: string;
    label: string;
  } | null;
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

type StoredUpload = {
  id: string;
  name: string;
  originalFileName: string;
  selectedSheetName: string;
  sheets: ParsedSheet[];
  resultsBySheet: Record<string, Record<number, SearchResult>>;
};

type ReferenceUploadRecord = {
  id: string;
  name: string;
  original_file_name: string;
  metadata: Record<string, unknown> | null;
};

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const normalizeName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const normalizeProfessionalName = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const isNamedProfessional = (value: unknown) => {
  const normalized = normalizeProfessionalName(value);
  if (!normalized) return false;

  const comparable = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return comparable !== "NAO INFORMADO";
};

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

const normalizeLabel = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const getValue = (row: ParsedRow, aliases: string[]) => {
  const key = Object.keys(row).find((candidate) => aliases.some((alias) => candidate.toUpperCase() === alias.toUpperCase()));
  return key ? String(row[key] ?? "") : "";
};

const chunk = <T>(items: T[], size = 250) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Credenciais internas do backend não configuradas para o armazenamento.");
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
};

const selectInBatches = async <T>(
  serviceClient: ReturnType<typeof createServiceClient>,
  table: string,
  columns: string,
  column: string,
  ids: string[],
  size = 150,
) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [] as T[];

  const rows: T[] = [];
  for (const batch of chunk(uniqueIds, size)) {
    const { data, error } = await serviceClient.from(table).select(columns).in(column, batch);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
  }

  return rows;
};

const deleteInBatches = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  table: string,
  column: string,
  ids: string[],
  size = 150,
) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;

  for (const batch of chunk(uniqueIds, size)) {
    const { error } = await serviceClient.from(table).delete().in(column, batch);
    if (error) throw error;
  }
};

const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const message = "message" in error ? String(error.message ?? "") : "";
    const details = "details" in error ? String(error.details ?? "") : "";
    const hint = "hint" in error ? String(error.hint ?? "") : "";
    const code = "code" in error ? String(error.code ?? "") : "";

    return [message, details, hint, code].filter(Boolean).join(" · ") || "Falha ao acessar o armazenamento da plataforma.";
  }

  return typeof error === "string" ? error : "Falha ao acessar o armazenamento da plataforma.";
};

const buildUploadRow = (
  row: ParsedRow,
  rowIndex: number,
  referenceUploadId: string,
  referenceUploadSheetId: string,
  result?: SearchResult,
) => ({
  owner_user_id: SYSTEM_OWNER_ID,
  reference_upload_id: referenceUploadId,
  reference_upload_sheet_id: referenceUploadSheetId,
  row_index: rowIndex,
  raw_data: row,
  search_name: normalizeName(getValue(row, ["NOME", "NO_CIDADAO", "PROFISSIONAL", "NO_PROFISSIONAL"])) || null,
  search_birth_date: normalizeDateValue(getValue(row, ["DN", "DATA NASCIMENTO", "DT_NASCIMENTO", "DT NASCIMENTO"])) || null,
  search_cpf: normalizeDigits(getValue(row, ["CPF", "NU_CPF_CIDADAO"])) || null,
  search_cns: normalizeDigits(getValue(row, ["CNS", "NU_CNS", "NU_CNS_CIDADAO"])) || null,
  match_found: Boolean(result?.found),
  match_source: result?.source ?? null,
  backend_match: result?.backend ?? {},
});

const isC2Sheet = (sheetName: string) => {
  const normalized = normalizeLabel(sheetName);
  return normalized.startsWith("C2") || normalized.includes("C2 - CUIDADO NO DESENVOLVIMENTO");
};

const isC3Sheet = (sheetName: string) => {
  const normalized = normalizeLabel(sheetName);
  return normalized.includes("C3") || normalized.includes("GESTANTE") || normalized.includes("PUERPERA");
};

const buildPatientKey = (payload: { nome?: unknown; cpf?: unknown; cns?: unknown; nascimento?: unknown }) => {
  const nome = normalizeName(payload.nome);
  const cpf = normalizeDigits(payload.cpf);
  const cns = normalizeDigits(payload.cns);
  const nascimento = normalizeDateValue(payload.nascimento);
  return [cpf, cns, nome, nascimento].join("|");
};

const fetchAllReferenceUploadRows = async (serviceClient: ReturnType<typeof createServiceClient>, sheetIds: string[]) => {
  if (!sheetIds.length) return [];

  const rows: Array<{
    reference_upload_sheet_id: string;
    row_index: number;
    raw_data: Record<string, unknown> | null;
    match_found: boolean | null;
    match_source: string | null;
    backend_match: Record<string, unknown> | null;
  }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient
      .from("reference_upload_rows")
      .select("reference_upload_sheet_id, row_index, raw_data, match_found, match_source, backend_match")
      .in("reference_upload_sheet_id", sheetIds)
      .order("reference_upload_sheet_id", { ascending: true })
      .order("row_index", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
};

const loadStoredUpload = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  upload: ReferenceUploadRecord | null,
): Promise<StoredUpload | null> => {
  if (!upload) return null;

  const { data: sheets, error: sheetsError } = await serviceClient
    .from("reference_upload_sheets")
    .select("id, sheet_name, upload_mode, column_names")
    .eq("reference_upload_id", upload.id)
    .order("created_at", { ascending: true });

  if (sheetsError) throw sheetsError;

  const sheetIds = (sheets ?? []).map((sheet) => sheet.id);
  const rows = await fetchAllReferenceUploadRows(serviceClient, sheetIds);

  const rowsBySheet = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    const list = rowsBySheet.get(row.reference_upload_sheet_id) ?? [];
    list.push(row);
    rowsBySheet.set(row.reference_upload_sheet_id, list);
  }

  const parsedSheets: ParsedSheet[] = [];
  const resultsBySheet: Record<string, Record<number, SearchResult>> = {};

  for (const sheet of sheets ?? []) {
    const sheetRows = rowsBySheet.get(sheet.id) ?? [];
    parsedSheets.push({
      name: sheet.sheet_name,
      columns: Array.isArray(sheet.column_names) ? sheet.column_names.filter(Boolean) : [],
      rows: sheetRows.map((row) => (row.raw_data ?? {}) as ParsedRow),
      mode: sheet.upload_mode as UploadMode,
    });

    resultsBySheet[sheet.sheet_name] = Object.fromEntries(
      sheetRows.map((row) => [
        row.row_index,
        {
          index: row.row_index,
          found: Boolean(row.match_found),
          source: (row.match_source ?? null) as SearchSource,
          backend: row.backend_match && Object.keys(row.backend_match).length > 0 ? (row.backend_match as Record<string, unknown>) : null,
        },
      ]),
    );
  }

  return {
    id: upload.id,
    name: upload.name,
    originalFileName: upload.original_file_name,
    selectedSheetName: String((upload.metadata ?? {}).selectedSheetName ?? parsedSheets[0]?.name ?? ""),
    sheets: parsedSheets,
    resultsBySheet,
  };
};

const loadActiveUpload = async (serviceClient: ReturnType<typeof createServiceClient>) => {
  const { data: upload, error: uploadError } = await serviceClient
    .from("reference_uploads")
    .select("id, name, original_file_name, metadata")
    .eq("owner_user_id", SYSTEM_OWNER_ID)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) throw uploadError;
  return loadStoredUpload(serviceClient, upload as ReferenceUploadRecord | null);
};

const loadUploadByReferenceId = async (serviceClient: ReturnType<typeof createServiceClient>, referenceUploadId: string) => {
  const { data: upload, error } = await serviceClient
    .from("reference_uploads")
    .select("id, name, original_file_name, metadata")
    .eq("id", referenceUploadId)
    .maybeSingle();

  if (error) throw error;
  return loadStoredUpload(serviceClient, upload as ReferenceUploadRecord | null);
};

const ensureIndicatorUpload = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  indicatorCode: typeof C2_INDICATOR_CODE | typeof C3_INDICATOR_CODE,
  payload: { referenceUploadId: string; name: string; originalFileName: string; selectedSheetName: string },
) => {
  const { data: existing, error: existingError } = await serviceClient
    .from("indicator_uploads")
    .select("id")
    .eq("reference_upload_id", payload.referenceUploadId)
    .eq("indicator_code", indicatorCode)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await serviceClient
      .from("indicator_uploads")
      .update({
        name: payload.name,
        original_file_name: payload.originalFileName,
        selected_sheet_name: payload.selectedSheetName,
        is_active: true,
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return existing.id as string;
  }

  const nowIso = new Date().toISOString();
  const { error: deactivateError } = await serviceClient
    .from("indicator_uploads")
    .update({ is_active: false, replaced_at: nowIso })
    .eq("owner_user_id", SYSTEM_OWNER_ID)
    .eq("indicator_code", indicatorCode)
    .eq("is_active", true);

  if (deactivateError) throw deactivateError;

  const { data: inserted, error: insertError } = await serviceClient
    .from("indicator_uploads")
    .insert({
      indicator_code: indicatorCode,
      owner_user_id: SYSTEM_OWNER_ID,
      reference_upload_id: payload.referenceUploadId,
      name: payload.name,
      original_file_name: payload.originalFileName,
      selected_sheet_name: payload.selectedSheetName,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id as string;
};

const syncIndicatorNominalBase = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  indicatorCode: typeof C2_INDICATOR_CODE | typeof C3_INDICATOR_CODE,
  payload: {
    referenceUploadId: string;
    name: string;
    originalFileName: string;
    selectedSheetName: string;
    sheets: ParsedSheet[];
    resultsBySheet: Record<string, Record<number, SearchResult>>;
  },
) => {
  const eligibleSheets = payload.sheets.filter((sheet) => {
    if (sheet.mode !== "citizen") return false;
    return indicatorCode === C2_INDICATOR_CODE ? isC2Sheet(sheet.name) : isC3Sheet(sheet.name);
  });

  if (!eligibleSheets.length) return null;

  const indicatorUploadId = await ensureIndicatorUpload(serviceClient, indicatorCode, {
    referenceUploadId: payload.referenceUploadId,
    name: payload.name,
    originalFileName: payload.originalFileName,
    selectedSheetName: payload.selectedSheetName,
  });

  const defaultSheetName = indicatorCode === C2_INDICATOR_CODE ? "C2 - Cuidado no desenvolvimento" : "C3 - Gestante e Puerperas";

  const nominalRows = eligibleSheets.flatMap((sheet) =>
    sheet.rows.map((row, index) => {
      const result = payload.resultsBySheet[sheet.name]?.[index];
      const backend = (result?.backend ?? {}) as Record<string, unknown>;
      const nome = String(backend.nomeBase ?? getValue(row, ["NOME", "NO_CIDADAO"]) ?? "").trim();
      const cpf = normalizeDigits(backend.cpfBase ?? getValue(row, ["CPF", "NU_CPF_CIDADAO"]));
      const cns = normalizeDigits(backend.cnsBase ?? getValue(row, ["CNS", "NU_CNS", "NU_CNS_CIDADAO"]));
      const sexo = String(backend.sexoBase ?? getValue(row, ["SEXO", "NO_SEXO"]) ?? "").trim();
      const acs = String(getValue(row, ["ACS", "NO_ACS", "AGENTE", "AGENTE COMUNITARIO", "AGENTE COMUNITARIO DE SAUDE"]) ?? "").trim();
      const nascimento = normalizeDateValue(backend.nascimentoBase ?? getValue(row, ["DN", "DATA NASCIMENTO", "DT_NASCIMENTO", "DT NASCIMENTO"])) || null;

      return {
        indicator_code: indicatorCode,
        owner_user_id: SYSTEM_OWNER_ID,
        indicator_upload_id: indicatorUploadId,
        sheet_name: sheet.name || defaultSheetName,
        patient_index: index,
        patient_key: buildPatientKey({ nome, cpf, cns, nascimento }),
        nome,
        cpf,
        cns,
        sexo,
        acs,
        nascimento,
        backend_nome: String(backend.nomeBase ?? "").trim(),
        backend_cpf: normalizeDigits(backend.cpfBase),
        backend_cns: normalizeDigits(backend.cnsBase),
        backend_sexo: String(backend.sexoBase ?? "").trim(),
        backend_unidade: String(backend.unidadeBase ?? "").trim(),
        backend_equipe: String(backend.equipeBase ?? "").trim(),
        source_snapshot: {
          row,
          result,
          selectedSheetName: payload.selectedSheetName,
        },
      };
    }),
  );

  if (!nominalRows.length) return indicatorUploadId;

  for (const batch of chunk(nominalRows)) {
    const { error } = await serviceClient.from("indicator_nominal_patients").upsert(batch, {
      onConflict: "indicator_upload_id,sheet_name,patient_index",
    });

    if (error) throw error;
  }

  return indicatorUploadId;
};

const ensureStoredIndicatorStructure = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  indicatorCode: typeof C2_INDICATOR_CODE | typeof C3_INDICATOR_CODE,
  referenceUploadId: string,
) => {
  const { data: existing, error: existingError } = await serviceClient
    .from("indicator_uploads")
    .select("id")
    .eq("reference_upload_id", referenceUploadId)
    .eq("indicator_code", indicatorCode)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const storedUpload = await loadUploadByReferenceId(serviceClient, referenceUploadId);
  if (!storedUpload) return null;

  return syncIndicatorNominalBase(serviceClient, indicatorCode, {
    referenceUploadId,
    name: storedUpload.name,
    originalFileName: storedUpload.originalFileName,
    selectedSheetName: storedUpload.selectedSheetName,
    sheets: storedUpload.sheets,
    resultsBySheet: storedUpload.resultsBySheet,
  });
};

const loadIndicatorCache = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  indicatorCode: typeof C2_INDICATOR_CODE | typeof C3_INDICATOR_CODE,
  referenceUploadId: string,
) => {
  const indicatorUploadId = await ensureStoredIndicatorStructure(serviceClient, indicatorCode, referenceUploadId);
  if (!indicatorUploadId) return [] as IndicatorPatient[];

  const patientStatusTable = indicatorCode === C2_INDICATOR_CODE ? "indicator_c2_patient_status" : "indicator_c3_patient_status";
  const flagStatusTable = indicatorCode === C2_INDICATOR_CODE ? "indicator_c2_flag_status" : "indicator_c3_flag_status";

  const { data: patientStatuses, error: patientStatusError } = await serviceClient
    .from(patientStatusTable)
    .select("id, nominal_patient_id, idade_em_meses, total_points, classification, completed_flags, pending_flags, tracking_flags")
    .eq("indicator_upload_id", indicatorUploadId)
    .order("total_points", { ascending: true })
    .order("pending_flags", { ascending: false });

  if (patientStatusError) throw patientStatusError;
  if (!(patientStatuses ?? []).length) return [] as IndicatorPatient[];

  const statusIds = (patientStatuses ?? []).map((patient) => patient.id as string);

  const [nominalPatients, flags] = await Promise.all([
    serviceClient
      .from("indicator_nominal_patients")
      .select("id, patient_index, nome, cpf, cns, nascimento, sexo, backend_unidade, backend_equipe")
      .eq("indicator_upload_id", indicatorUploadId)
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
    selectInBatches<{
      patient_status_id: string;
      flag_key: string;
      title: string;
      status: string;
      completed: boolean;
      points: number;
      earned_points: number;
      metric: string;
      summary: string;
      detail: string;
      source_snapshot: { events?: IndicatorProcedureEvent[] } | null;
    }>(
      serviceClient,
      flagStatusTable,
      "patient_status_id, flag_key, title, status, completed, points, earned_points, metric, summary, detail, source_snapshot",
      "patient_status_id",
      statusIds,
    ).then((data) => data.sort((a, b) => a.flag_key.localeCompare(b.flag_key))),
  ]);

  const nominalById = new Map<string, (typeof nominalPatients)[number]>((nominalPatients ?? []).map((patient) => [patient.id as string, patient]));
  const flagsByStatusId = new Map<string, IndicatorFlag[]>();

  for (const flag of flags ?? []) {
    const list = flagsByStatusId.get(flag.patient_status_id as string) ?? [];
      list.push({
        key: flag.flag_key as IndicatorFlag["key"],
        title: flag.title,
        status: flag.status as IndicatorFlag["status"],
        completed: Boolean(flag.completed),
        points: Number(flag.points ?? 0),
        earnedPoints: Number(flag.earned_points ?? 0),
        metric: flag.metric ?? "",
        summary: flag.summary ?? "",
        detail: flag.detail ?? "",
        deadline:
          flag.source_snapshot && typeof flag.source_snapshot === "object" && !Array.isArray(flag.source_snapshot) && "deadline" in flag.source_snapshot
            ? {
                date: String((flag.source_snapshot as { deadline?: { date?: unknown } }).deadline?.date ?? ""),
                label: String((flag.source_snapshot as { deadline?: { label?: unknown } }).deadline?.label ?? "Data limite para registro"),
              }
            : null,
        events: Array.isArray(flag.source_snapshot?.events)
          ? flag.source_snapshot.events
              .map((event) => ({
                date: String(event?.date ?? ""),
                professional: normalizeProfessionalName(event?.professional ?? ""),
              }))
              .filter((event) => event.date && isNamedProfessional(event.professional))
          : [],
      });
    flagsByStatusId.set(flag.patient_status_id as string, list);
  }

  return (patientStatuses ?? []).flatMap((patientStatus) => {
    const nominal = nominalById.get(patientStatus.nominal_patient_id as string);
    if (!nominal) return [];

    return [{
      index: Number(nominal.patient_index ?? 0),
      nome: nominal.nome ?? "",
      cpf: nominal.cpf ?? "",
      cns: nominal.cns ?? "",
      nascimento: nominal.nascimento ? String(nominal.nascimento) : "",
      sexo: nominal.sexo ?? "",
      unidade: nominal.backend_unidade ?? "",
      equipe: nominal.backend_equipe ?? "",
      idadeEmMeses: Number(patientStatus.idade_em_meses ?? 0),
      totalPoints: Number(patientStatus.total_points ?? 0),
      classification: patientStatus.classification as IndicatorPatient["classification"],
      completedFlags: Number(patientStatus.completed_flags ?? 0),
      pendingFlags: Number(patientStatus.pending_flags ?? 0),
      trackingFlags: Number(patientStatus.tracking_flags ?? 0),
      flags: flagsByStatusId.get(patientStatus.id as string) ?? [],
    }];
  });
};

const replaceIndicatorCache = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  indicatorCode: typeof C2_INDICATOR_CODE | typeof C3_INDICATOR_CODE,
  referenceUploadId: string,
  patients: IndicatorPatient[],
) => {
  const indicatorUploadId = await ensureStoredIndicatorStructure(serviceClient, indicatorCode, referenceUploadId);
  if (!indicatorUploadId) {
    throw new Error(`Não foi possível preparar a base nominal do indicador ${indicatorCode === C2_INDICATOR_CODE ? "C2" : "C3"} para este upload.`);
  }

  const patientStatusTable = indicatorCode === C2_INDICATOR_CODE ? "indicator_c2_patient_status" : "indicator_c3_patient_status";
  const flagStatusTable = indicatorCode === C2_INDICATOR_CODE ? "indicator_c2_flag_status" : "indicator_c3_flag_status";
  const defaultSheetName = indicatorCode === C2_INDICATOR_CODE ? "C2 - Cuidado no desenvolvimento" : "C3 - Gestante e Puerperas";

  const { data: nominalPatients, error: nominalPatientsError } = await serviceClient
    .from("indicator_nominal_patients")
    .select("id, patient_index, patient_key, nome, cpf, cns, nascimento, sexo, acs, backend_unidade, backend_equipe")
    .eq("indicator_upload_id", indicatorUploadId);

  if (nominalPatientsError) throw nominalPatientsError;

  const nominalByIndex = new Map<number, (typeof nominalPatients)[number]>((nominalPatients ?? []).map((patient) => [Number(patient.patient_index), patient]));
  const nominalByKey = new Map<string, (typeof nominalPatients)[number]>((nominalPatients ?? []).map((patient) => [String(patient.patient_key), patient]));

  const { data: existingStatuses, error: existingStatusesError } = await serviceClient
    .from(patientStatusTable)
    .select("id, nominal_patient_id")
    .eq("indicator_upload_id", indicatorUploadId);

  if (existingStatusesError) throw existingStatusesError;

  const { data: refreshRecord, error: refreshError } = await serviceClient
    .from("indicator_procedure_refreshes")
    .insert({
      indicator_code: indicatorCode,
      owner_user_id: SYSTEM_OWNER_ID,
      indicator_upload_id: indicatorUploadId,
      refresh_scope: "procedures",
      status: "completed",
      summary: {
        patients: patients.length,
      },
    })
    .select("id")
    .single();

  if (refreshError) throw refreshError;

  if (!patients.length) {
    const existingStatusIds = (existingStatuses ?? []).map((status) => status.id as string);
    if (existingStatusIds.length > 0) {
      await deleteInBatches(serviceClient, flagStatusTable, "patient_status_id", existingStatusIds);
      await deleteInBatches(serviceClient, patientStatusTable, "id", existingStatusIds);
    }
    return;
  }

  const missingNominalRows = patients
    .filter((patient) => !nominalByIndex.has(patient.index) && !nominalByKey.has(buildPatientKey(patient)))
    .map((patient) => ({
      indicator_code: indicatorCode,
      owner_user_id: SYSTEM_OWNER_ID,
      indicator_upload_id: indicatorUploadId,
      sheet_name: defaultSheetName,
      patient_index: patient.index,
      patient_key: buildPatientKey(patient),
      nome: patient.nome,
      cpf: normalizeDigits(patient.cpf),
      cns: normalizeDigits(patient.cns),
      sexo: patient.sexo,
      acs: "",
      nascimento: normalizeDateValue(patient.nascimento) || null,
      backend_nome: patient.nome,
      backend_cpf: normalizeDigits(patient.cpf),
      backend_cns: normalizeDigits(patient.cns),
      backend_sexo: patient.sexo,
      backend_unidade: patient.unidade,
      backend_equipe: patient.equipe,
      source_snapshot: patient,
    }));

  if (missingNominalRows.length > 0) {
    for (const batch of chunk(missingNominalRows)) {
      const { error } = await serviceClient.from("indicator_nominal_patients").upsert(batch, {
        onConflict: "indicator_upload_id,sheet_name,patient_index",
      });
      if (error) throw error;
    }

    const { data: refreshedNominals, error: refreshedNominalsError } = await serviceClient
      .from("indicator_nominal_patients")
      .select("id, patient_index, patient_key, nome, cpf, cns, nascimento, sexo, acs, backend_unidade, backend_equipe")
      .eq("indicator_upload_id", indicatorUploadId);

    if (refreshedNominalsError) throw refreshedNominalsError;

    nominalByIndex.clear();
    nominalByKey.clear();
    for (const patient of refreshedNominals ?? []) {
      nominalByIndex.set(Number(patient.patient_index), patient);
      nominalByKey.set(String(patient.patient_key), patient);
    }
  }

  const patientRows = patients.flatMap((patient) => {
    const nominalPatient = nominalByIndex.get(patient.index) ?? nominalByKey.get(buildPatientKey(patient));
    if (!nominalPatient?.id) return [];

    return [{
      owner_user_id: SYSTEM_OWNER_ID,
      indicator_upload_id: indicatorUploadId,
      nominal_patient_id: nominalPatient.id,
      refresh_id: refreshRecord.id,
      idade_em_meses: patient.idadeEmMeses,
      total_points: patient.totalPoints,
      classification: patient.classification,
      completed_flags: patient.completedFlags,
      pending_flags: patient.pendingFlags,
      tracking_flags: patient.trackingFlags,
      source_snapshot: patient,
    }];
  });

  const currentNominalIds = [...new Set(patientRows.map((row) => row.nominal_patient_id))];
  const existingStatusIds = (existingStatuses ?? []).map((status) => status.id as string);
  const staleStatusIds = (existingStatuses ?? [])
    .filter((status) => !currentNominalIds.includes(status.nominal_patient_id as string))
    .map((status) => status.id as string);

  if (existingStatusIds.length > 0) {
    await deleteInBatches(serviceClient, flagStatusTable, "patient_status_id", existingStatusIds);
  }

  if (staleStatusIds.length > 0) {
    await deleteInBatches(serviceClient, patientStatusTable, "id", staleStatusIds);
  }

  const { data: upsertedStatuses, error: upsertStatusesError } = await serviceClient
    .from(patientStatusTable)
    .upsert(patientRows, {
      onConflict: "nominal_patient_id",
    })
    .select("id, nominal_patient_id");

  if (upsertStatusesError) throw upsertStatusesError;

  const statusIdByNominalId = new Map<string, string>((upsertedStatuses ?? []).map((status) => [status.nominal_patient_id as string, status.id as string]));
  const flagRows = patients.flatMap((patient) => {
    const nominalPatient = nominalByIndex.get(patient.index) ?? nominalByKey.get(buildPatientKey(patient));
    if (!nominalPatient?.id) return [];

    const patientStatusId = statusIdByNominalId.get(nominalPatient.id as string);
    if (!patientStatusId) return [];

    return patient.flags.map((flag) => ({
      owner_user_id: SYSTEM_OWNER_ID,
      patient_status_id: patientStatusId,
      nominal_patient_id: nominalPatient.id,
      flag_key: flag.key,
      title: flag.title,
      status: flag.status,
      completed: flag.completed,
      points: flag.points,
      earned_points: flag.earnedPoints,
      metric: flag.metric,
      summary: flag.summary,
      detail: flag.detail,
      source_snapshot: flag,
    }));
  });

  for (const batch of chunk(flagRows)) {
    const { error: upsertFlagsError } = await serviceClient.from(flagStatusTable).upsert(batch, {
      onConflict: "patient_status_id,flag_key",
    });
    if (upsertFlagsError) throw upsertFlagsError;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let action = "unknown";

  try {
    const body = await req.json();
    action = String(body?.action ?? "unknown");
    const serviceClient = createServiceClient();

    if (action === "load_active_upload") {
      const upload = await loadActiveUpload(serviceClient);
      return new Response(JSON.stringify({ success: true, upload }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "replace_active_upload") {
      const sheets = Array.isArray(body?.sheets) ? (body.sheets as ParsedSheet[]) : [];
      const selectedSheetName = String(body?.selectedSheetName ?? sheets[0]?.name ?? "");
      const name = String(body?.name ?? "Planilha de referência");
      const originalFileName = String(body?.originalFileName ?? name);

      const uploadMode = sheets.find((sheet) => sheet.mode === "citizen")?.mode ?? sheets[0]?.mode ?? "citizen";
      const nowIso = new Date().toISOString();

      const { error: deactivateError } = await serviceClient
        .from("reference_uploads")
        .update({ is_active: false, replaced_at: nowIso })
        .eq("owner_user_id", SYSTEM_OWNER_ID)
        .eq("is_active", true);

      if (deactivateError) throw deactivateError;

      const { data: insertedUpload, error: uploadError } = await serviceClient
        .from("reference_uploads")
        .insert({
          owner_user_id: SYSTEM_OWNER_ID,
          name,
          original_file_name: originalFileName,
          upload_mode: uploadMode,
          is_active: true,
          metadata: {
            selectedSheetName,
          },
        })
        .select("id")
        .single();

      if (uploadError) throw uploadError;
      const referenceUploadId = insertedUpload.id as string;

      for (const sheet of sheets) {
        const { data: insertedSheet, error: sheetError } = await serviceClient
          .from("reference_upload_sheets")
          .insert({
            owner_user_id: SYSTEM_OWNER_ID,
            reference_upload_id: referenceUploadId,
            sheet_name: sheet.name,
            upload_mode: sheet.mode,
            row_count: sheet.rows.length,
            column_names: sheet.columns,
          })
          .select("id")
          .single();

        if (sheetError) throw sheetError;
        const referenceUploadSheetId = insertedSheet.id as string;

        const uploadRows = sheet.rows.map((row, rowIndex) => buildUploadRow(row, rowIndex, referenceUploadId, referenceUploadSheetId));
        for (const batch of chunk(uploadRows)) {
          const { error: rowsError } = await serviceClient.from("reference_upload_rows").insert(batch);
          if (rowsError) throw rowsError;
        }
      }

      const syncReplaceWork = (async () => {
        try {
          const bgClient = createServiceClient();
          await Promise.all([
            syncIndicatorNominalBase(bgClient, C2_INDICATOR_CODE, {
              referenceUploadId,
              name,
              originalFileName,
              selectedSheetName,
              sheets,
              resultsBySheet: {},
            }),
            syncIndicatorNominalBase(bgClient, C3_INDICATOR_CODE, {
              referenceUploadId,
              name,
              originalFileName,
              selectedSheetName,
              sheets,
              resultsBySheet: {},
            }),
          ]);
        } catch (err) {
          console.error("[reference-storage] Background sync (replace) error:", err);
        }
      })();

      // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(syncReplaceWork);
      } else {
        await syncReplaceWork;
      }

      return new Response(JSON.stringify({ success: true, uploadId: referenceUploadId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_sheet_results" || action === "update_sheet_result_deltas") {
      const referenceUploadId = String(body?.referenceUploadId ?? "");
      const sheetName = String(body?.sheetName ?? "");
      const selectedSheetName = String(body?.selectedSheetName ?? sheetName);
      const results = (body?.results ?? {}) as Record<number, SearchResult>;
      const isDeltaUpdate = action === "update_sheet_result_deltas";

      if (!referenceUploadId || !sheetName) {
        return new Response(JSON.stringify({ success: false, error: "Upload e aba são obrigatórios para atualizar os resultados." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: upload, error: uploadError } = await serviceClient
        .from("reference_uploads")
        .select("metadata")
        .eq("id", referenceUploadId)
        .maybeSingle();

      if (uploadError) throw uploadError;

      const { data: sheet, error: sheetError } = await serviceClient
        .from("reference_upload_sheets")
        .select("id")
        .eq("reference_upload_id", referenceUploadId)
        .eq("sheet_name", sheetName)
        .maybeSingle();

      if (sheetError) throw sheetError;
      if (!sheet?.id) {
        return new Response(JSON.stringify({ success: false, error: "Aba não encontrada no upload armazenado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rowIndexes = [...new Set(
        Object.keys(results)
          .map((key) => Number(key))
          .filter((value) => Number.isInteger(value)),
      )];

      if (!rowIndexes.length) {
        return new Response(JSON.stringify({ success: true, updated: true, changedCount: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rowIdByIndex = new Map<number, string>();
      for (const rowIndexBatch of chunk(rowIndexes, 120)) {
        const { data: existingRows, error: rowsError } = await serviceClient
          .from("reference_upload_rows")
          .select("id, row_index")
          .eq("reference_upload_id", referenceUploadId)
          .eq("reference_upload_sheet_id", sheet.id)
          .in("row_index", rowIndexBatch);

        if (rowsError) throw rowsError;

        for (const row of existingRows ?? []) {
          rowIdByIndex.set(Number(row.row_index), row.id as string);
        }
      }
      const updates = rowIndexes
        .map((rowIndex) => {
          const rowId = rowIdByIndex.get(rowIndex);
          const result = results[rowIndex];
          if (!rowId || !result) return null;

          return {
            id: rowId,
            match_found: Boolean(result.found),
            match_source: result.source ?? null,
            backend_match: result.backend ?? {},
          };
        })
        .filter(Boolean) as Array<{ id: string; match_found: boolean; match_source: SearchSource; backend_match: Record<string, unknown> }>;

      for (const batch of chunk(updates, 100)) {
        const batchResults = await Promise.all(
          batch.map(async ({ id, ...update }) => {
            const { error } = await serviceClient.from("reference_upload_rows").update(update).eq("id", id);
            return error;
          }),
        );

        const firstError = batchResults.find(Boolean);
        if (firstError) throw firstError;
      }

      const nextMetadata = {
        ...(upload?.metadata ?? {}),
        selectedSheetName,
      };

      const { error: metadataError } = await serviceClient.from("reference_uploads").update({ metadata: nextMetadata }).eq("id", referenceUploadId);
      if (metadataError) throw metadataError;

      if (!isDeltaUpdate) {
        const syncWork = (async () => {
          try {
            const bgClient = createServiceClient();
            const storedUpload = await loadUploadByReferenceId(bgClient, referenceUploadId);
            if (storedUpload) {
              const mergedResults = {
                ...storedUpload.resultsBySheet,
                [sheetName]: {
                  ...storedUpload.resultsBySheet[sheetName],
                  ...results,
                },
              };
              await Promise.all([
                syncIndicatorNominalBase(bgClient, C2_INDICATOR_CODE, {
                  referenceUploadId,
                  name: storedUpload.name,
                  originalFileName: storedUpload.originalFileName,
                  selectedSheetName,
                  sheets: storedUpload.sheets,
                  resultsBySheet: mergedResults,
                }),
                syncIndicatorNominalBase(bgClient, C3_INDICATOR_CODE, {
                  referenceUploadId,
                  name: storedUpload.name,
                  originalFileName: storedUpload.originalFileName,
                  selectedSheetName,
                  sheets: storedUpload.sheets,
                  resultsBySheet: mergedResults,
                }),
              ]);
            }
          } catch (err) {
            console.error("[reference-storage] Background sync error:", err);
          }
        })();

        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(syncWork);
        } else {
          await syncWork;
        }
      }

      return new Response(JSON.stringify({ success: true, updated: true, changedCount: updates.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "load_indicator_c2_cache") {
      const referenceUploadId = String(body?.referenceUploadId ?? "");
      if (!referenceUploadId) {
        return new Response(JSON.stringify({ success: false, error: "Upload de referência é obrigatório para carregar o cache do indicador." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const patients = await loadIndicatorCache(serviceClient, C2_INDICATOR_CODE, referenceUploadId);
      return new Response(JSON.stringify({ success: true, patients }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "replace_indicator_c2_cache") {
      const referenceUploadId = String(body?.referenceUploadId ?? "");
      const patients = Array.isArray(body?.patients) ? (body.patients as IndicatorPatient[]) : [];
      if (!referenceUploadId) {
        return new Response(JSON.stringify({ success: false, error: "Upload de referência é obrigatório para salvar o cache do indicador." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await replaceIndicatorCache(serviceClient, C2_INDICATOR_CODE, referenceUploadId, patients);
      return new Response(JSON.stringify({ success: true, updated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "load_indicator_c3_cache") {
      const referenceUploadId = String(body?.referenceUploadId ?? "");
      if (!referenceUploadId) {
        return new Response(JSON.stringify({ success: false, error: "Upload de referência é obrigatório para carregar o cache do indicador C3." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const patients = await loadIndicatorCache(serviceClient, C3_INDICATOR_CODE, referenceUploadId);
      return new Response(JSON.stringify({ success: true, patients }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "replace_indicator_c3_cache") {
      const referenceUploadId = String(body?.referenceUploadId ?? "");
      const patients = Array.isArray(body?.patients) ? (body.patients as IndicatorPatient[]) : [];
      if (!referenceUploadId) {
        return new Response(JSON.stringify({ success: false, error: "Upload de referência é obrigatório para salvar o cache do indicador C3." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await replaceIndicatorCache(serviceClient, C3_INDICATOR_CODE, referenceUploadId, patients);
      return new Response(JSON.stringify({ success: true, updated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Ação de armazenamento não reconhecida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = describeError(error);
    console.error("reference-storage error", { action, message, error });

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});