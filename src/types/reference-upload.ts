export type UploadMode = "citizen" | "professional";

export type ParsedRow = Record<string, string>;

export type ParsedSheet = {
  name: string;
  columns: string[];
  rows: ParsedRow[];
  mode: UploadMode;
};

export type BackendMatch = {
  nomeBase?: string;
  cpfBase?: string;
  cnsBase?: string;
  unidadeBase?: string;
  telefoneBase?: string;
  sexoBase?: string;
  nascimentoBase?: string;
  equipeBase?: string;
  profissionalBase?: string;
};

export type SearchSource =
  | "cpf"
  | "cns"
  | "nome_data_nascimento"
  | "nome"
  | "data_nascimento"
  | null;

export type SearchResult = {
  index: number;
  found: boolean;
  source: SearchSource;
  backend: BackendMatch | null;
};

export type SearchResponse = {
  success: boolean;
  results: SearchResult[];
  error?: string;
  incremental?: boolean;
  changedCount?: number;
  unchangedCount?: number;
  totalRows?: number;
  refreshedAt?: string;
};

export type IndicatorFlagKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";

export type IndicatorFlagStatus = "done" | "attention" | "tracking";


export type IndicatorFlagDeadline = {
  date: string;
  label: string;
};

export type AnthropometryRecord = {
  date: string;
  weight: number | null;
  height: number | null;
};

export type IndicatorProcedureEvent = {
  date: string;
  professional: string;
};

export type IndicatorFlag = {
  key: IndicatorFlagKey;
  title: string;
  status: IndicatorFlagStatus;
  completed: boolean;
  points: number;
  metric: string;
  summary: string;
  detail: string;
  deadline?: IndicatorFlagDeadline | null;
  events?: IndicatorProcedureEvent[];
};

export type IndicatorClassification = "regular" | "suficiente" | "bom" | "otimo";

export type IndicatorPatient = {
  index: number;
  nome: string;
  cpf: string;
  cns: string;
  nascimento: string;
  sexo: string;
  unidade: string;
  equipe: string;
  acs?: string;
  microarea?: string;
  idadeEmMeses: number;
  totalPoints: number;
  classification: IndicatorClassification;
  completedFlags: number;
  pendingFlags: number;
  trackingFlags: number;
  isIncomplete?: boolean;
  // Support for SIAPS enrichment and debugging
  sourceRow?: Record<string, string>;
  flags: IndicatorFlag[];
  anthropometryRecords?: AnthropometryRecord[];
};

export type IndicatorResponse = {
  success: boolean;
  patients: IndicatorPatient[];
  error?: string;
};

export const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export const normalizeName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export const normalizeDateValue = (value: unknown) => {
  const input = String(value ?? "").trim();
  if (!input) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const slashMatch = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const isoDate = new Date(input);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toISOString().slice(0, 10);
  }

  return "";
};

export const detectMode = (columns: string[]): UploadMode => {
  const upper = columns.map((column) => column.toUpperCase());
  const hasProfessional = upper.includes("PROFISSIONAL");
  const hasCitizenName = upper.includes("NOME");

  return hasProfessional && !hasCitizenName ? "professional" : "citizen";
};

export const getValue = (row: ParsedRow, aliases: string[]) => {
  const match = Object.keys(row).find((key) => aliases.some((alias) => key.toUpperCase() === alias.toUpperCase()));
  return match ? String(row[match] ?? "") : "";
};
