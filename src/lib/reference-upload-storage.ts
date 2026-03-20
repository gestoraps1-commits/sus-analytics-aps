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

const invokeStorage = async <T,>(body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("reference-storage", { body });

  if (error) {
    throw new Error(error.message || "Falha ao acessar o armazenamento da plataforma.");
  }

  const response = data as EdgeEnvelope<T>;

  if (!response.success) {
    throw new Error(response.error || "Falha ao acessar o armazenamento da plataforma.");
  }

  return response;
};

export const loadPersistedUpload = async () => {
  const response = await invokeStorage<{ upload: LoadedReferenceUpload | null }>({ action: "load_active_upload" });
  return response.upload;
};

export const replacePersistedUpload = async (payload: {
  name: string;
  originalFileName: string;
  selectedSheetName: string;
  sheets: ParsedSheet[];
}) => {
  const response = await invokeStorage<{ uploadId: string }>({
    action: "replace_active_upload",
    ...payload,
  });

  return response.uploadId;
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
