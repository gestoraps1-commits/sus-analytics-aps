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
  const [isHydrating, setIsHydrating] = useState(true);

  const [activeSource, setActiveSourceState] = useState<"standard" | "siaps">("standard");
  const [hasStandard, setHasStandard] = useState(false);
  const [hasSiaps, setHasSiaps] = useState(false);

  const hydratePersistedUpload = useCallback(async () => {
    setIsHydrating(true);
    try {
      const response = await loadPersistedUpload();
      
      setActiveSourceState(response?.activeSource || "standard");
      setHasStandard(response?.hasStandard || false);
      setHasSiaps(response?.hasSiaps || false);

      const persistedUpload = response?.upload;
      if (!persistedUpload) {
        setReferenceUploadId(null);
        setSheets([]);
        setResultsBySheet({});
        setSelectedSheetName("");
        setIsHydrating(false);
        return;
      }
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
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void hydratePersistedUpload();
  }, [hydratePersistedUpload]);

  const handleToggleSource = useCallback(async (newSource: "standard" | "siaps") => {
    try {
      setIsHydrating(true);
      const { setActiveSource } = await import("@/lib/reference-upload-storage");
      await setActiveSource(newSource);
      await hydratePersistedUpload();
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err.message || "Falha ao alternar a fonte de dados. Verifique se você já fez algum upload para ela.");
      setIsHydrating(false);
    }
  }, [hydratePersistedUpload]);

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
    isHydrating,
    activeSource,
    hasStandard,
    hasSiaps,
    handleToggleSource,
  };
}
