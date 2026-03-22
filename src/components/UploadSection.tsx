import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Loader2, SearchCheck, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  ParsedSheet,
  SearchResponse,
  SearchResult,
  detectMode,
  getValue,
  normalizeDateValue,
  normalizeDigits,
} from "@/types/reference-upload";
import { updatePersistedSheetResultDeltas, updatePersistedSheetResults } from "@/lib/reference-upload-storage";

type UploadSectionProps = {
  sheets: ParsedSheet[];
  selectedSheetName: string;
  results: Record<number, SearchResult>;
  referenceUploadId: string | null;
  onSheetsChange: (sheets: ParsedSheet[]) => void;
  onSelectedSheetNameChange: (sheetName: string) => void;
  onResultsChange: (results: Record<number, SearchResult>) => void;
  onReferenceUploadIdChange: (referenceUploadId: string | null) => void;
  onIndicatorLoadStageChange?: (stage: "idle" | "uploading" | "matching" | "indicator" | "ready" | "error") => void;
  activeSource?: "standard" | "siaps";
  hasStandard?: boolean;
  hasSiaps?: boolean;
  onToggleSource?: (sourceType: "standard" | "siaps") => void;
};

export const UploadSection = ({
  sheets,
  selectedSheetName,
  results,
  referenceUploadId,
  onSheetsChange,
  onSelectedSheetNameChange,
  onResultsChange,
  onReferenceUploadIdChange,
  onIndicatorLoadStageChange,
  activeSource = "standard",
  hasStandard = false,
  hasSiaps = false,
  onToggleSource,
}: UploadSectionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshKeyRef = useRef<string | null>(null);

  const selectedSheet = useMemo(
    () => sheets.find((sheet) => sheet.name === selectedSheetName) ?? null,
    [selectedSheetName, sheets],
  );

  const matchedCount = useMemo(
    () => Object.values(results).filter((result) => result.found).length,
    [results],
  );

  const handleFileChange = (sourceType: "standard" | "siaps") => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    onIndicatorLoadStageChange?.("uploading");
    onResultsChange({});

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      const parsedSheets = workbook.SheetNames
        .map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: "",
            raw: false,
            dateNF: "dd/mm/yyyy",
          });

          const columns = Array.from(
            rows.reduce((set, row) => {
              Object.keys(row).forEach((key) => set.add(key));
              return set;
            }, new Set<string>()),
          );

          return {
            name: sheetName,
            columns,
            rows: rows.map((row) =>
              Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])),
            ),
            mode: detectMode(columns),
          } satisfies ParsedSheet;
        })
        .filter((sheet) => sheet.rows.length > 0);

      onSheetsChange(parsedSheets);
      const preferredSheetName = parsedSheets.find((sheet) => sheet.mode === "citizen")?.name ?? parsedSheets[0]?.name ?? "";
      onSelectedSheetNameChange(preferredSheetName);

      const { replacePersistedUpload } = await import("@/lib/reference-upload-storage");
      const uploadId = await replacePersistedUpload({
        name: file.name.replace(/\.[^.]+$/, "") || "Planilha de referência",
        originalFileName: file.name,
        selectedSheetName: preferredSheetName,
        sheets: parsedSheets,
        sourceType,
      });
      onReferenceUploadIdChange(uploadId);
      onIndicatorLoadStageChange?.("matching");
    } catch {
      onIndicatorLoadStageChange?.("error");
      setError("Não foi possível ler a planilha. Envie um arquivo .xlsx válido.");
    }
  };

  useEffect(() => {
    const searchSheet = async () => {
      if (!selectedSheet) return;

      const payloadRows = selectedSheet.rows
        .map((row, index) => ({
          index,
          cpf: getValue(row, ["CPF", "NU_CPF_CIDADAO"]),
          cns: getValue(row, ["CNS", "NU_CNS", "NU_CNS_CIDADAO"]),
          nome: getValue(row, ["NOME", "NO_CIDADAO", "PROFISSIONAL", "NO_PROFISSIONAL"]),
          nascimento: getValue(row, ["DN", "DATA NASCIMENTO", "DT_NASCIMENTO", "DT NASCIMENTO"]),
          profissional: getValue(row, ["PROFISSIONAL", "NO_PROFISSIONAL"]),
          unidade: getValue(row, ["UNIDADE", "NO_UNIDADE_SAUDE"]),
          acs: getValue(row, ["ACS"]),
        }))
        .filter(
          (row) =>
            normalizeDigits(row.cpf) ||
            normalizeDigits(row.cns) ||
            row.nome?.trim() ||
            normalizeDateValue(row.nascimento)
        );

      if (!payloadRows.length) {
        onResultsChange({});
        onIndicatorLoadStageChange?.("error");
        setError("A aba selecionada não possui referência suficiente para buscar na base.");
        return;
      }

      const refreshKey = `${referenceUploadId ?? "local"}:${selectedSheet.name}`;
      const hasCachedResults = Object.keys(results).length > 0;
      const shouldSkipRefresh = hasCachedResults && lastRefreshKeyRef.current === refreshKey;

      if (shouldSkipRefresh) {
        onIndicatorLoadStageChange?.("ready");
        setIsLoading(false);
        return;
      }

      lastRefreshKeyRef.current = refreshKey;
      setIsLoading(true);
      onIndicatorLoadStageChange?.(hasCachedResults ? "indicator" : "matching");
      setError(null);

      const { data, error } = await supabase.functions.invoke("search-reference-data", {
        body: {
          mode: selectedSheet.mode,
          rows: payloadRows,
          cachedResults: hasCachedResults ? results : undefined,
        },
      });

      if (error) {
        onIndicatorLoadStageChange?.("error");
        setError(error.message || "Falha ao consultar a base remota.");
        if (!hasCachedResults) {
          onResultsChange({});
        }
        setIsLoading(false);
        return;
      }

      const response = data as SearchResponse;

      if (!response.success) {
        onIndicatorLoadStageChange?.("error");
        setError(response.error || "Falha ao consultar a base remota.");
        if (!hasCachedResults) {
          onResultsChange({});
        }
        setIsLoading(false);
        return;
      }

      const nextResults = Object.fromEntries(response.results.map((result) => [result.index, result]));
      const mergedResults = hasCachedResults ? { ...results, ...nextResults } : nextResults;
      onResultsChange(mergedResults);
      onIndicatorLoadStageChange?.("indicator");

      if (referenceUploadId) {
        if (hasCachedResults && (response.changedCount ?? 0) > 0) {
          await updatePersistedSheetResultDeltas({
            referenceUploadId,
            sheetName: selectedSheet.name,
            selectedSheetName,
            results: nextResults,
          });
        } else if (!hasCachedResults) {
          await updatePersistedSheetResults({
            referenceUploadId,
            sheetName: selectedSheet.name,
            selectedSheetName,
            results: nextResults,
          });
        }
      }

      onIndicatorLoadStageChange?.("ready");
      setIsLoading(false);
    };

    void searchSheet();
  }, [referenceUploadId, results, selectedSheet, selectedSheetName, onResultsChange, onIndicatorLoadStageChange]);

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="space-y-2 mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Upload & Gestão de Fontes</p>
          <h3 className="text-2xl font-black tracking-tight text-foreground">Bases de Referência para Busca Ativa</h3>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Faça upload do Excel (e-SUS/PEC ou SIAPS) e ative a fonte desejada.
            Apenas os dados da fonte ativa estarão disponíveis em todo o sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Standard */}
          <div className={`relative p-8 rounded-[2rem] border-2 transition-all duration-300 flex flex-col justify-between ${
            activeSource === 'standard' 
              ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
              : 'border-border bg-background/50 hover:border-primary/30'
          }`}>
            <div className="flex flex-col mb-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`font-black tracking-tight text-xl ${activeSource === 'standard' ? 'text-primary' : 'text-foreground'}`}>
                    Fonte Padrão
                  </h4>
                  <p className="text-sm font-medium text-muted-foreground mt-1">Integração e-SUS PEC</p>
                </div>
                {activeSource === 'standard' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs uppercase bg-primary text-primary-foreground rounded-full shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Base Ativa
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleSource?.('standard')}
                    className="px-4 py-1.5 font-bold text-xs uppercase bg-accent text-accent-foreground rounded-full hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                  >
                    Ativar Fonte Padrão
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Utiliza planilhas convencionais originadas do PEC ou exportações e-SUS contendo colunas detalhadas de Numerador e Denominador. Requer cruzamento avançado por regras.
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/50">
              <label className="inline-flex w-full cursor-pointer justify-center items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition bg-background shadow-sm border border-border hover:bg-accent hover:text-accent-foreground text-foreground">
                <Upload className="h-4 w-4" />
                Substituir Base Padrão
                <input type="file" accept=".xlsx,.xls" className="hidden" onClick={(e) => (e.target as HTMLInputElement).value = ""} onChange={handleFileChange('standard')} />
              </label>
            </div>
          </div>

          {/* SIAPS */}
          <div className={`relative p-8 rounded-[2rem] border-2 transition-all duration-300 flex flex-col justify-between ${
            activeSource === 'siaps' 
              ? 'border-[#ff7a45] bg-[#ff7a45]/5 shadow-md shadow-[#ff7a45]/10' 
              : 'border-border bg-background/50 hover:border-[#ff7a45]/30'
          }`}>
            <div className="flex flex-col mb-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`font-black tracking-tight text-xl ${activeSource === 'siaps' ? 'text-[#ff7a45]' : 'text-foreground'}`}>
                    Fonte SIAPS
                  </h4>
                  <p className="text-sm font-medium text-muted-foreground mt-1">Central de Indicadores</p>
                </div>
                {activeSource === 'siaps' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs uppercase bg-[#ff7a45] text-white rounded-full shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Base Ativa
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleSource?.('siaps')}
                    className="px-4 py-1.5 font-bold text-xs uppercase bg-accent text-accent-foreground rounded-full hover:bg-[#ff7a45] hover:text-white transition-all shadow-sm"
                  >
                    Ativar Fonte SIAPS
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Utiliza a base centralizada do SIAPS. Faz cruzamento dinâmico na base remota para identificação de pacientes e profissionais.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <label className="inline-flex w-full cursor-pointer justify-center items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition bg-background shadow-sm border border-border hover:bg-accent hover:text-accent-foreground text-foreground">
                <Upload className="h-4 w-4" />
                Substituir Base SIAPS
                <input type="file" accept=".xlsx,.xls" className="hidden" onClick={(e) => (e.target as HTMLInputElement).value = ""} onChange={handleFileChange('siaps')} />
              </label>
            </div>
          </div>
        </div>

        {sheets.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Arquivo carregado</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-accent" />
                {sheets.length} aba(s) reconhecida(s)
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Linhas da aba</p>
              <p className="mt-2 text-base font-semibold text-foreground">{selectedSheet?.rows.length ?? 0}</p>
            </div>

            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Encontrados na base</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <SearchCheck className="h-4 w-4 text-accent" />
                {matchedCount}
              </p>
            </div>
          </div>
        ) : null}

        {sheets.length > 1 ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aba da planilha</label>
            <select
              value={selectedSheetName}
              onChange={(event) => onSelectedSheetNameChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none ring-0"
            >
              {sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {isLoading ? (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Buscando na base</AlertTitle>
            <AlertDescription>Consultando os registros correspondentes da aba selecionada.</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Falha no upload/busca</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {selectedSheet ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.5rem] border border-border">
              <div className="max-h-[70vh] overflow-auto bg-card">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur">
                    <tr>
                      {selectedSheet.columns.map((column) => (
                        <th key={column} className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">
                          {column}
                        </th>
                      ))}
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">Status Base</th>
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">Nome Base</th>
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">CPF Base</th>
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">CNS Base</th>
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">Unidade Base</th>
                      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSheet.rows.slice(0, 100).map((row, index) => {
                      const result = results[index];
                      return (
                        <tr key={`${selectedSheet.name}-${index}`} className="odd:bg-background even:bg-muted/20">
                          {selectedSheet.columns.map((column) => (
                            <td key={`${index}-${column}`} className="border-b border-border/70 px-4 py-3 align-top text-foreground">
                              {row[column] || "-"}
                            </td>
                          ))}
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <span className={result?.found ? "font-semibold text-foreground" : activeSource === 'siaps' ? "font-semibold text-destructive" : "text-muted-foreground"}>
                              {result?.found ? "Encontrado" : activeSource === 'siaps' ? "Paciente não identificado na base de dados" : "Não encontrado"}
                            </span>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top text-foreground">{result?.backend?.nomeBase || result?.backend?.profissionalBase || "-"}</td>
                          <td className="border-b border-border/70 px-4 py-3 align-top text-foreground">{result?.backend?.cpfBase || "-"}</td>
                          <td className="border-b border-border/70 px-4 py-3 align-top text-foreground">{result?.backend?.cnsBase || "-"}</td>
                          <td className="border-b border-border/70 px-4 py-3 align-top text-foreground">{result?.backend?.unidadeBase || result?.backend?.equipeBase || "-"}</td>
                          <td className="border-b border-border/70 px-4 py-3 align-top text-foreground">{result?.backend?.telefoneBase || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedSheet.rows.length > 100 && (
              <p className="text-center text-xs text-muted-foreground italic">
                Exibindo apenas os primeiros 100 registros de {selectedSheet.rows.length} para melhor performance.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-border bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
            Envie uma planilha para carregar a nova seção de upload e buscar somente esses registros na base.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
