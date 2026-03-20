import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, indicatorCacheKey, searchCacheKey, isCacheStale } from "@/lib/idb-cache";
import { updatePersistedSheetResults } from "@/lib/reference-upload-storage";
import {
  getValue,
  IndicatorPatient,
  IndicatorResponse,
  ParsedSheet,
  SearchResponse,
  SearchResult,
  normalizeDateValue,
  normalizeDigits,
} from "@/types/reference-upload";

export type IndicatorSectionConfig = {
  /** Unique section key, e.g. "c3", "c5" */
  sectionKey: string;
  /** Edge function name, e.g. "c5-hypertension-indicator" */
  edgeFunctionName: string;
  /** Batch size for edge function calls (0 = no batching) */
  batchSize: number;
  /** Error message prefix */
  errorLabel: string;
};

type UseIndicatorDataParams = {
  config: IndicatorSectionConfig;
  selectedSheet: ParsedSheet | null;
  results: Record<number, SearchResult>;
  referenceUploadId: string | null;
  enabled?: boolean;
};

const buildReferenceRows = (sheet: ParsedSheet) =>
  sheet.rows
    .map((row, index) => ({
      index,
      cpf: getValue(row, ["CPF", "NU_CPF_CIDADAO"]),
      cns: getValue(row, ["CNS", "NU_CNS", "NU_CNS_CIDADAO"]),
      nome: getValue(row, ["NOME", "NO_CIDADAO", "PROFISSIONAL", "NO_PROFISSIONAL"]),
      nascimento: getValue(row, ["DN", "DATA NASCIMENTO", "DT_NASCIMENTO", "DT NASCIMENTO"]),
      profissional: getValue(row, ["PROFISSIONAL", "NO_PROFISSIONAL"]),
      unidade: getValue(row, ["UNIDADE", "NO_UNIDADE_SAUDE"]),
      acs: getValue(row, ["ACS"]),
      microarea: getValue(row, ["MICROAREA", "MICRO_AREA", "MICRO AREA"]),
    }))
    .filter(
      (row) =>
        normalizeDigits(row.cpf) ||
        normalizeDigits(row.cns) ||
        row.nome?.trim() ||
        normalizeDateValue(row.nascimento),
    );

const sortIndicatorPatients = (patients: IndicatorPatient[]) =>
  [...patients].sort(
    (a, b) =>
      a.totalPoints - b.totalPoints ||
      b.pendingFlags - a.pendingFlags ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

async function resolveSearchResults(
  sheet: ParsedSheet,
  externalResults: Record<number, SearchResult>,
  referenceUploadId: string | null,
): Promise<Record<number, SearchResult>> {
  // If we already have external results, use them
  if (Object.keys(externalResults).length > 0) return externalResults;

  // Try IndexedDB cache for search results
  if (referenceUploadId) {
    const cacheKey = searchCacheKey(sheet.name, referenceUploadId);
    const cached = await idbGet<Record<number, SearchResult>>(cacheKey);
    if (cached && !isCacheStale(cached.timestamp)) {
      return cached.data;
    }
  }

  // Fetch from edge function
  const referenceRows = buildReferenceRows(sheet);
  if (!referenceRows.length) return {};

  const { data: searchData, error: searchError } = await supabase.functions.invoke(
    "search-reference-data",
    { body: { mode: sheet.mode, rows: referenceRows } },
  );

  if (searchError) throw new Error(searchError.message || "Falha ao consultar a base nominal.");

  const searchResponse = searchData as SearchResponse;
  if (!searchResponse.success) throw new Error(searchResponse.error || "Falha ao consultar a base nominal.");

  const resolved = Object.fromEntries(
    searchResponse.results.map((result) => [result.index, result]),
  );

  // Persist search results
  if (referenceUploadId) {
    const cacheKey = searchCacheKey(sheet.name, referenceUploadId);
    void idbSet(cacheKey, resolved, referenceUploadId);

    void updatePersistedSheetResults({
      referenceUploadId,
      sheetName: sheet.name,
      selectedSheetName: sheet.name,
      results: resolved,
    }).catch(() => {});
  }

  return resolved;
}

async function fetchIndicatorData(
  config: IndicatorSectionConfig,
  sheet: ParsedSheet,
  externalResults: Record<number, SearchResult>,
  referenceUploadId: string | null,
): Promise<IndicatorPatient[]> {
  const resolvedResults = await resolveSearchResults(sheet, externalResults, referenceUploadId);

  const indicatorRows = buildReferenceRows(sheet)
    .map((referenceRow) => {
      const result = resolvedResults[referenceRow.index];
      return {
        index: referenceRow.index,
        cpf: result?.backend?.cpfBase || referenceRow.cpf,
        cns: result?.backend?.cnsBase || referenceRow.cns,
        nome: result?.backend?.nomeBase || referenceRow.nome,
        nascimento: result?.backend?.nascimentoBase || referenceRow.nascimento,
        sexo: result?.backend?.sexoBase || "",
        unidade: result?.backend?.unidadeBase || referenceRow.unidade,
        equipe: result?.backend?.equipeBase || "",
        sourceRow: sheet.rows[referenceRow.index],
      };
    })
    .filter((row) => row.nome || row.cpf || row.cns);

  if (!indicatorRows.length) return [];

  // Build acs/microarea lookup from reference rows
  const refRows = buildReferenceRows(sheet);
  const acsLookup = new Map<number, { acs: string; microarea: string }>();
  for (const ref of refRows) {
    acsLookup.set(ref.index, { acs: ref.acs, microarea: ref.microarea });
  }

  const patients: IndicatorPatient[] = [];
  const batchSize = config.batchSize || 200; // Default batch size increased to 200

  const indicatorPatients: IndicatorPatient[] = [];
  const limit = 4; // Max concurrent requests
  const chunks = [];
  
  for (let i = 0; i < indicatorRows.length; i += batchSize) {
    chunks.push(indicatorRows.slice(i, i + batchSize));
  }

  // Process chunks with controlled concurrency
  for (let i = 0; i < chunks.length; i += limit) {
    const currentBatch = chunks.slice(i, i + limit);
    const results = await Promise.all(
      currentBatch.map(batchRows => 
        supabase.functions.invoke(config.edgeFunctionName, {
          body: { rows: batchRows },
        })
      )
    );

    for (const { data, error } of results) {
      if (error) throw new Error(error.message || `Falha ao calcular ${config.errorLabel}.`);

      const response = data as IndicatorResponse;
      if (!response.success) throw new Error(response.error || `Falha ao calcular ${config.errorLabel}.`);

      // Enrich with acs/microarea from sheet
      for (const p of response.patients) {
        const extra = acsLookup.get(p.index);
        if (extra) {
          p.acs = extra.acs;
          p.microarea = extra.microarea;
        }
      }

      indicatorPatients.push(...response.patients);
    }
  }

  patients.push(...indicatorPatients);

  // Cache to IndexedDB
  if (referenceUploadId) {
    const cacheKey = indicatorCacheKey(config.sectionKey, sheet.name, referenceUploadId);
    void idbSet(cacheKey, patients, referenceUploadId);
  }

  return sortIndicatorPatients(patients);
}

export function useIndicatorData({
  config,
  selectedSheet,
  results,
  referenceUploadId,
  enabled = true,
}: UseIndicatorDataParams) {
  const queryClient = useQueryClient();
  const configRef = useRef(config);
  configRef.current = config;

  const queryKey = [
    "indicator",
    config.sectionKey,
    selectedSheet?.name ?? null,
    referenceUploadId ?? null,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedSheet || selectedSheet.mode !== "citizen") return [];
      return fetchIndicatorData(configRef.current, selectedSheet, results, referenceUploadId);
    },
    enabled: enabled && !!selectedSheet && selectedSheet.mode === "citizen",
    staleTime: Infinity, // Cache permanente durante a sessão
    gcTime: 24 * 60 * 60 * 1000, // 24 horas de coleta de lixo
    refetchOnWindowFocus: false,
    retry: 1,
    // Use IndexedDB cache as initial data
    placeholderData: undefined,
    initialData: undefined,
  });

  // Provide a way to seed from IDB cache on mount
  const hydrateFromCache = useCallback(async () => {
    if (!selectedSheet || !referenceUploadId) return;
    const cacheKey = indicatorCacheKey(config.sectionKey, selectedSheet.name, referenceUploadId);
    const cached = await idbGet<IndicatorPatient[]>(cacheKey);
    if (cached?.data?.length) {
      queryClient.setQueryData(queryKey, sortIndicatorPatients(cached.data));
    }
  }, [config.sectionKey, queryClient, queryKey, referenceUploadId, selectedSheet]);

  return {
    patients: (query.data ?? []) as IndicatorPatient[],
    isLoading: query.isLoading || query.isFetching,
    isInitialLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    hydrateFromCache,
    queryKey,
  };
}

/** Prefetch indicator data for a section without rendering it */
export function prefetchIndicatorData(
  queryClient: ReturnType<typeof useQueryClient>,
  config: IndicatorSectionConfig,
  sheet: ParsedSheet | null,
  results: Record<number, SearchResult>,
  referenceUploadId: string | null,
) {
  if (!sheet || sheet.mode !== "citizen") return;

  const queryKey = ["indicator", config.sectionKey, sheet.name, referenceUploadId ?? null];

  // Only prefetch if not already cached
  const existing = queryClient.getQueryData(queryKey);
  if (existing) return;

  void queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchIndicatorData(config, sheet, results, referenceUploadId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Section configs for all indicators */
export const INDICATOR_CONFIGS: Record<string, IndicatorSectionConfig> = {
  c2: {
    sectionKey: "c2",
    edgeFunctionName: "c2-development-indicator",
    batchSize: 100,
    errorLabel: "o indicador de desenvolvimento infantil",
  },
  c3: {
    sectionKey: "c3",
    edgeFunctionName: "c3-gestation-indicator",
    batchSize: 0, // C3 doesn't batch
    errorLabel: "o indicador de gestação e puerpério",
  },
  c4: {
    sectionKey: "c4",
    edgeFunctionName: "c4-diabetes-indicator",
    batchSize: 100,
    errorLabel: "o indicador de pessoas com diabetes",
  },
  c5: {
    sectionKey: "c5",
    edgeFunctionName: "c5-hypertension-indicator",
    batchSize: 100,
    errorLabel: "o indicador de pessoas com hipertensão",
  },
  c6: {
    sectionKey: "c6",
    edgeFunctionName: "c6-older-person-indicator",
    batchSize: 100,
    errorLabel: "o indicador de pessoas idosas",
  },
  c7: {
    sectionKey: "c7",
    edgeFunctionName: "c7-pccu-prevention-indicator",
    batchSize: 100,
    errorLabel: "o indicador PCCU e prevenção",
  },
};
