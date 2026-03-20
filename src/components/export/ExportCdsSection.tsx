import { useCallback, useMemo, useState } from "react";
import { Download, FileDown, FileSpreadsheet, FileText, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIndicatorData, INDICATOR_CONFIGS } from "@/hooks/useIndicatorData";
import {
  IndicatorClassification,
  IndicatorPatient,
  ParsedSheet,
  SearchResult,
} from "@/types/reference-upload";

/* ── types ──────────────────────────────────────────────── */

type SectionOption = {
  key: string;
  label: string;
};

const SECTION_OPTIONS: SectionOption[] = [
  { key: "c2", label: "C2 – Desenv. Infantil" },
  { key: "c3", label: "C3 – Gestantes e Puérperas" },
  { key: "c4", label: "C4 – Pessoa com Diabetes" },
  { key: "c5", label: "C5 – Pessoa com Hipertensão" },
  { key: "c6", label: "C6 – Pessoa Idosa" },
  { key: "c7", label: "C7 – PCCU e Prevenção" },
];

type StatusFilter = "all" | "done" | "attention" | "tracking";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "done", label: "Sem pendências" },
  { value: "attention", label: "Pendentes" },
  { value: "tracking", label: "Em acompanhamento" },
];

const CLASSIFICATION_OPTIONS: { value: IndicatorClassification; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "suficiente", label: "Suficiente" },
  { value: "bom", label: "Bom" },
  { value: "otimo", label: "Ótimo" },
];

type ExportFormat = "excel" | "pdf";

type ExportCdsSectionProps = {
  sheets: ParsedSheet[];
  selectedSheetName: string;
  resultsBySheet: Record<string, Record<number, SearchResult>>;
  referenceUploadId: string | null;
  sheetsBySection: Record<string, ParsedSheet | null>;
};

const selectClassName =
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const SECTION_LABEL: Record<string, string> = {
  c2: "C2", c3: "C3", c4: "C4", c5: "C5", c6: "C6", c7: "C7",
};

const STATUS_LABEL: Record<string, string> = {
  done: "OK",
  attention: "Pendente",
  tracking: "Acompanhamento",
};

/* ── helpers ─────────────────────────────────────────────── */

/** Ensures CPF/CNS are always formatted as text strings – keep empty when absent */
const formatCpf = (v: unknown): string => {
  const raw = String(v ?? "").replace(/\D/g, "");
  return raw ? raw : "";
};
const formatCns = (v: unknown): string => {
  const raw = String(v ?? "").replace(/\D/g, "");
  return raw ? raw : "";
};

/** Convert YYYY-MM-DD → DD/MM/YYYY for display; keep empty when absent */
const formatDateDisplay = (v: unknown): string => {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
};

/** Safe string: coalesce null / undefined / "null" / "undefined" → "" */
const safeStr = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v);
  return s === "null" || s === "undefined" ? "" : s;
};

const buildProcedureList = (flags: IndicatorPatient["flags"]) =>
  flags.map((f) => `• ${f.title}: ${STATUS_LABEL[f.status] ?? f.status}`);

/* ── component ──────────────────────────────────────────── */

export const ExportCdsSection = ({
  sheets,
  selectedSheetName,
  resultsBySheet,
  referenceUploadId,
  sheetsBySection,
}: ExportCdsSectionProps) => {
  const [selectedSections, setSelectedSections] = useState<string[]>(["c2"]);
  const [unitFilter, setUnitFilter] = useState("all");
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  // Load indicator data for each selected section
  const sheetFor = (key: string) => sheetsBySection[key] ?? null;
  const resultsFor = (key: string) => {
    const s = sheetFor(key);
    return s ? resultsBySheet[s.name] ?? {} : {};
  };

  const c2Data = useIndicatorData({ config: INDICATOR_CONFIGS.c2, selectedSheet: sheetFor("c2"), results: resultsFor("c2"), referenceUploadId, enabled: selectedSections.includes("c2") });
  const c3Data = useIndicatorData({ config: INDICATOR_CONFIGS.c3, selectedSheet: sheetFor("c3"), results: resultsFor("c3"), referenceUploadId, enabled: selectedSections.includes("c3") });
  const c4Data = useIndicatorData({ config: INDICATOR_CONFIGS.c4, selectedSheet: sheetFor("c4"), results: resultsFor("c4"), referenceUploadId, enabled: selectedSections.includes("c4") });
  const c5Data = useIndicatorData({ config: INDICATOR_CONFIGS.c5, selectedSheet: sheetFor("c5"), results: resultsFor("c5"), referenceUploadId, enabled: selectedSections.includes("c5") });
  const c6Data = useIndicatorData({ config: INDICATOR_CONFIGS.c6, selectedSheet: sheetFor("c6"), results: resultsFor("c6"), referenceUploadId, enabled: selectedSections.includes("c6") });
  const c7Data = useIndicatorData({ config: INDICATOR_CONFIGS.c7, selectedSheet: sheetFor("c7"), results: resultsFor("c7"), referenceUploadId, enabled: selectedSections.includes("c7") });

  const dataBySection: Record<string, { patients: IndicatorPatient[]; isLoading: boolean }> = {
    c2: c2Data, c3: c3Data, c4: c4Data, c5: c5Data, c6: c6Data, c7: c7Data,
  };

  const allPatients = useMemo(() => {
    const patients: Array<IndicatorPatient & { sectionKey: string }> = [];
    for (const sectionKey of selectedSections) {
      const data = dataBySection[sectionKey];
      if (data?.patients) {
        for (const p of data.patients) {
          patients.push({ ...p, sectionKey });
        }
      }
    }
    return patients;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSections, c2Data.patients, c3Data.patients, c4Data.patients, c5Data.patients, c6Data.patients, c7Data.patients]);

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    for (const p of allPatients) {
      if (p.unidade) units.add(p.unidade);
    }
    return Array.from(units).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allPatients]);

  const procedureOptions = useMemo(() => {
    const procedures = new Set<string>();
    for (const p of allPatients) {
      for (const flag of p.flags) {
        procedures.add(flag.title);
      }
    }
    return Array.from(procedures).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allPatients]);

  const filteredPatients = useMemo(() => {
    return allPatients.filter((p) => {
      if (unitFilter !== "all" && p.unidade !== unitFilter) return false;
      if (classificationFilter !== "all" && p.classification !== classificationFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "done" && p.pendingFlags > 0) return false;
        if (statusFilter === "attention" && p.pendingFlags === 0) return false;
        if (statusFilter === "tracking" && p.trackingFlags === 0) return false;
      }
      if (selectedProcedures.length > 0) {
        const patientProcedures = p.flags.map((f) => f.title);
        if (!selectedProcedures.some((proc) => patientProcedures.includes(proc))) return false;
      }
      return true;
    });
  }, [allPatients, unitFilter, classificationFilter, statusFilter, selectedProcedures]);

  const isAnyLoading = selectedSections.some((s) => dataBySection[s]?.isLoading);

  const toggleSection = useCallback((key: string) => {
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  }, []);

  const toggleProcedure = useCallback((proc: string) => {
    setSelectedProcedures((prev) =>
      prev.includes(proc) ? prev.filter((p) => p !== proc) : [...prev, proc],
    );
  }, []);

  /* ── EXCEL export ─────────────────────────────────────── */
  const handleExportExcel = useCallback(() => {
    if (filteredPatients.length === 0) return;
    setIsExporting(true);

    try {
      // Collect all unique procedure titles across patients to use as column headers
      const allProcTitles: string[] = [];
      const procTitleSet = new Set<string>();
      for (const p of filteredPatients) {
        for (const f of p.flags) {
          if (!procTitleSet.has(f.title)) {
            procTitleSet.add(f.title);
            allProcTitles.push(f.title);
          }
        }
      }

      const rows = filteredPatients.map((p) => {
        const lastAnthro = p.anthropometryRecords?.[0];
        const row: Record<string, unknown> = {
          "Seção": SECTION_LABEL[p.sectionKey] ?? p.sectionKey,
          "Nome": safeStr(p.nome),
          "CPF": formatCpf(p.cpf),
          "CNS": formatCns(p.cns),
          "Data Nascimento": formatDateDisplay(p.nascimento),
          "Sexo": safeStr(p.sexo),
          "ACS": safeStr(p.acs),
          "Microárea": safeStr(p.microarea),
          "Peso (kg)": lastAnthro?.weight != null ? lastAnthro.weight : "",
          "Altura (cm)": lastAnthro?.height != null ? lastAnthro.height : "",
          "Classificação": safeStr(p.classification),
        };
        // Add each procedure as its own column with the status as value
        const flagMap = new Map(p.flags.map((f) => [f.title, f]));
        for (const title of allProcTitles) {
          const flag = flagMap.get(title);
          row[title] = flag ? (STATUS_LABEL[flag.status] ?? flag.status) : "";
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Force CPF and CNS columns to text format (cols 2,3)
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cpfCell = ws[XLSX.utils.encode_cell({ r: row, c: 2 })];
        const cnsCell = ws[XLSX.utils.encode_cell({ r: row, c: 3 })];
        if (cpfCell) { cpfCell.t = "s"; cpfCell.z = "@"; }
        if (cnsCell) { cnsCell.t = "s"; cnsCell.z = "@"; }
      }

      // Column widths: fixed cols + procedure cols
      const fixedCols = [
        { wch: 6 }, { wch: 35 }, { wch: 14 }, { wch: 18 },
        { wch: 14 }, { wch: 6 }, { wch: 20 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 12 },
      ];
      const procCols = allProcTitles.map((t) => ({ wch: Math.max(t.length + 2, 18) }));
      ws["!cols"] = [...fixedCols, ...procCols];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exportação CDS");
      XLSX.writeFile(wb, `exportacao_cds_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }, [filteredPatients]);

  /* ── PDF export ───────────────────────────────────────── */
  const handleExportPdf = useCallback(() => {
    if (filteredPatients.length === 0) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(14);
      doc.text("Exportação CDS – Boas Práticas APS", 14, 15);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 21);

      const tableRows = filteredPatients.map((p) => {
        const lastAnthro = p.anthropometryRecords?.[0];
        return [
          SECTION_LABEL[p.sectionKey] ?? p.sectionKey,
          safeStr(p.nome),
          formatCpf(p.cpf),
          formatCns(p.cns),
          formatDateDisplay(p.nascimento),
          safeStr(p.sexo),
          safeStr(p.acs),
          safeStr(p.microarea),
          lastAnthro?.weight != null ? String(lastAnthro.weight).replace(".", ",") : "",
          lastAnthro?.height != null ? String(lastAnthro.height).replace(".", ",") : "",
          buildProcedureList(p.flags).join("\n"),
        ];
      });

      autoTable(doc, {
        startY: 25,
        head: [["Seção", "Nome", "CPF", "CNS", "Nasc.", "Sexo", "ACS", "Microárea", "Peso", "Altura", "Procedimentos"]],
        body: tableRows,
        styles: { fontSize: 6, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { cellWidth: 20 },
          3: { cellWidth: 22 },
          4: { cellWidth: 16 },
          5: { cellWidth: 8 },
          6: { cellWidth: 18 },
          7: { cellWidth: 12 },
          8: { cellWidth: 10 },
          9: { cellWidth: 10 },
          10: { cellWidth: "auto" },
        },
      });

      doc.save(`exportacao_cds_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsExporting(false);
    }
  }, [filteredPatients]);

  return (
    <div className="space-y-6">
      {/* Section selector */}
      <Card className="rounded-[1.75rem] border-border shadow-sm">
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subseção</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Exportar arquivo para CDS</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados essenciais do paciente: nome, CPF, CNS, data de nascimento, sexo, peso, altura e procedimentos em lista.
            </p>
          </div>

          {/* Section checkboxes */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Seções de indicadores
            </Label>
            <div className="flex flex-wrap gap-3">
              {SECTION_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                    selectedSections.includes(opt.key)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Checkbox
                    checked={selectedSections.includes(opt.key)}
                    onCheckedChange={() => toggleSection(opt.key)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="space-y-4 rounded-[1.75rem] border border-border bg-card/95 p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filtros de exportação</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Unidade</span>
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={selectClassName}>
              <option value="all">Todas as unidades</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Situação</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectClassName}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Classificação</span>
            <select value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)} className={selectClassName}>
              <option value="all">Todas</option>
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        {procedureOptions.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Procedimentos (selecione 1 ou mais)
            </span>
            <div className="flex flex-wrap gap-2">
              {procedureOptions.map((proc) => (
                <label
                  key={proc}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                    selectedProcedures.includes(proc)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Checkbox
                    checked={selectedProcedures.includes(proc)}
                    onCheckedChange={() => toggleProcedure(proc)}
                    className="h-3.5 w-3.5"
                  />
                  {proc}
                </label>
              ))}
            </div>
            {selectedProcedures.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedProcedures([])}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Limpar seleção de procedimentos
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview & export */}
      <Card className="rounded-[1.75rem] border-border shadow-sm">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Prévia da exportação</p>
              <p className="text-sm text-muted-foreground">
                {isAnyLoading
                  ? "Carregando dados dos indicadores..."
                  : `${filteredPatients.length} paciente(s) encontrado(s) com os filtros aplicados.`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportExcel}
                disabled={filteredPatients.length === 0 || isAnyLoading || isExporting}
                className="gap-2 rounded-2xl"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={filteredPatients.length === 0 || isAnyLoading || isExporting}
                className="gap-2 rounded-2xl"
              >
                <FileText className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Summary badges */}
          {!isAnyLoading && filteredPatients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedSections.map((s) => {
                const count = filteredPatients.filter((p) => p.sectionKey === s).length;
                if (count === 0) return null;
                return (
                  <Badge key={s} variant="secondary" className="rounded-full">
                    {s.toUpperCase()}: {count} pacientes
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Preview table */}
          {!isAnyLoading && filteredPatients.length > 0 && (
            <div className="max-h-[400px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seção</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">CPF</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">CNS</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nascimento</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sexo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ACS</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Microárea</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Procedimentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPatients.slice(0, 50).map((p, i) => (
                    <tr key={`${p.sectionKey}-${p.index}-${i}`} className="hover:bg-muted/30 transition">
                      <td className="px-3 py-2 font-medium">{p.sectionKey.toUpperCase()}</td>
                      <td className="px-3 py-2">{safeStr(p.nome)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{formatCpf(p.cpf)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{formatCns(p.cns)}</td>
                      <td className="px-3 py-2">{formatDateDisplay(p.nascimento)}</td>
                      <td className="px-3 py-2">{safeStr(p.sexo)}</td>
                      <td className="px-3 py-2">{safeStr(p.acs)}</td>
                      <td className="px-3 py-2">{safeStr(p.microarea)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <ul className="list-disc list-inside space-y-0.5">
                          {p.flags.map((f) => (
                            <li key={f.key}>
                              <span className="font-medium text-foreground">{f.title}</span>:{" "}
                              <span className={cn(
                                f.status === "done" && "text-primary",
                                f.status === "attention" && "text-destructive",
                                f.status === "tracking" && "text-muted-foreground",
                              )}>
                                {STATUS_LABEL[f.status] ?? f.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPatients.length > 50 && (
                <p className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  Exibindo 50 de {filteredPatients.length} registros. Todos serão exportados.
                </p>
              )}
            </div>
          )}

          {!isAnyLoading && filteredPatients.length === 0 && selectedSections.length > 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Download className="h-8 w-8 opacity-40" />
              <p className="text-sm">Nenhum paciente encontrado com os filtros selecionados.</p>
            </div>
          )}

          {selectedSections.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Filter className="h-8 w-8 opacity-40" />
              <p className="text-sm">Selecione ao menos uma seção de indicadores para exportar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
