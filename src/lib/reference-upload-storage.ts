import { supabase } from "@/integrations/supabase/client";
import type { IndicatorPatient, ParsedSheet, SearchResult } from "@/types/reference-upload";

export type LoadedReferenceUpload = {
  id: string;
  name: string;
  originalFileName: string;
  selectedSheetName: string;
  sheets: ParsedSheet[];
  resultsBySheet: Record<string, Record<number, SearchResult>>;
};

type EdgeEnvelope<T> = T & {
  success: boolean;
  error?: string;
};

const invokeStorage = async <T>(payload: any): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("reference-storage", {
    body: payload,
  });

  if (error) {
    console.error("🔥 EDGE FUNCTION FATAL ERROR:", error);
    if ('context' in error) {
      try {
        const body = await (error as any).context.clone().json();
        console.error("🔥 EDGE FUNCTION RAW RESPONSE:", body);
      } catch (e) {
        console.error("🔥 EDGE FUNCTION BODY UNPARSABLE");
      }
    }
    throw new Error(error.message || "Falha ao acessar o armazenamento da plataforma.");
  }

  // The `data` object returned by the edge function is an EdgeEnvelope<T>
  const response = data as EdgeEnvelope<T>;

  if (!response.success) {
    throw new Error(response.error || "Operação falhou no servidor.");
  }

  // If successful, we return the inner T type, which is part of the EdgeEnvelope
  return response as T;
};

export const loadPersistedUpload = async () => {
  const response = await invokeStorage<{
    upload: LoadedReferenceUpload | null;
    activeSource: "standard" | "siaps";
    hasStandard: boolean;
    hasSiaps: boolean;
  }>({ action: "load_active_upload" });
  return response;
};

export const replacePersistedUpload = async (payload: {
  name: string;
  originalFileName: string;
  selectedSheetName: string;
  sheets: ParsedSheet[];
  sourceType?: "standard" | "siaps";
}) => {
  const response = await invokeStorage<{ uploadId: string }>({
    action: "replace_active_upload",
    ...payload,
  });

  return response.uploadId;
};

export const setActiveSource = async (sourceType: "standard" | "siaps") => {
  const response = await invokeStorage<{ activeId: string }>({
    action: "set_active_source",
    sourceType,
  });
  return response.activeId;
};

export const updatePersistedSheetResults = async (payload: {
  referenceUploadId: string;
  sheetName: string;
  selectedSheetName: string;
  results: Record<number, SearchResult>;
}) => {
  await invokeStorage<{ updated: boolean }>({
    action: "update_sheet_results",
    ...payload,
  });
};

export const updatePersistedSheetResultDeltas = async (payload: {
  referenceUploadId: string;
  sheetName: string;
  selectedSheetName: string;
  results: Record<number, SearchResult>;
}) => {
  await invokeStorage<{ updated: boolean }>({
    action: "update_sheet_result_deltas",
    ...payload,
  });
};

export const loadIndicatorC2Cache = async (referenceUploadId: string) => {
  const response = await invokeStorage<{ patients: IndicatorPatient[] }>({
    action: "load_indicator_c2_cache",
    referenceUploadId,
  });

  return response.patients;
};

export const replaceIndicatorC2Cache = async (payload: {
  referenceUploadId: string;
  patients: IndicatorPatient[];
}) => {
  await invokeStorage<{ updated: boolean }>({
    action: "replace_indicator_c2_cache",
    ...payload,
  });
};

export const loadIndicatorC3Cache = async (referenceUploadId: string) => {
  const response = await invokeStorage<{ patients: IndicatorPatient[] }>({
    action: "load_indicator_c3_cache",
    referenceUploadId,
  });

  return response.patients;
};

export const replaceIndicatorC3Cache = async (payload: {
  referenceUploadId: string;
  patients: IndicatorPatient[];
}) => {
  await invokeStorage<{ updated: boolean }>({
    action: "replace_indicator_c3_cache",
    ...payload,
  });
};
