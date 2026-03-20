import { useCallback, useEffect, useState } from "react";
import { loadPersistedUpload } from "@/lib/reference-upload-storage";
import { ParsedSheet, SearchResult } from "@/types/reference-upload";

export type IndicatorLoadStage = "idle" | "uploading" | "matching" | "indicator" | "ready" | "error";

export function useReferenceUpload() {
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [referenceUploadId, setReferenceUploadId] = useState<string | null>(null);
  const [resultsBySheet, setResultsBySheet] = useState<Record<string, Record<number, SearchResult>>>({});
  const [indicatorLoadStage, setIndicatorLoadStage] = useState<IndicatorLoadStage>("idle");

  useEffect(() => {
    const hydratePersistedUpload = async () => {
      try {
        const persistedUpload = await loadPersistedUpload();
        if (!persistedUpload) return;
        setReferenceUploadId(persistedUpload.id);
        setSheets(persistedUpload.sheets);
        setResultsBySheet(persistedUpload.resultsBySheet);
        setSelectedSheetName(
          persistedUpload.sheets.find((sheet) => sheet.mode === "citizen")?.name || 
          persistedUpload.selectedSheetName || 
          persistedUpload.sheets[0]?.name || ""
        );
        setIndicatorLoadStage("ready");
      } catch {
        setReferenceUploadId(null);
        setIndicatorLoadStage("error");
      }
    };
    void hydratePersistedUpload();
  }, []);

  const handleSheetsChange = useCallback((nextSheets: ParsedSheet[]) => { 
    setSheets(nextSheets); 
  }, []);

  const handleSelectedSheetNameChange = useCallback((sheetName: string) => { 
    setSelectedSheetName(sheetName); 
  }, []);

  const handleResultsChange = useCallback(
    (nextResults: Record<number, SearchResult>) => {
      setResultsBySheet((current) => ({ ...current, [selectedSheetName]: nextResults }));
    },
    [selectedSheetName]
  );

  return {
    sheets,
    setSheets: handleSheetsChange,
    selectedSheetName,
    setSelectedSheetName: handleSelectedSheetNameChange,
    referenceUploadId,
    setReferenceUploadId,
    resultsBySheet,
    setResultsBySheet,
    handleResultsChange,
    indicatorLoadStage,
    setIndicatorLoadStage,
  };
}
