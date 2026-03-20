import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, ClipboardList, FileDown, FileSpreadsheet, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AuditDashboard } from "@/components/audit/AuditDashboard";
import { exportAuditDashboardPdf } from "@/components/audit/AuditDashboardPdf";

type AuditRecord = {
  date: string;
  professional: string;
  procedure: string;
  unit: string;
  patient: string;
  source: string;
  indicator: string;
  searchString?: string;
};

type AuditResult = {
  success: boolean;
  records: AuditRecord[];
  filters: { units: string[]; professionals: string[] };
  total: number;
  error?: string;
};

const selectClassName =
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const formatDateBR = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const INDICATOR_OPTIONS = [
  { value: "all", label: "Todos os indicadores" },
  { value: "c1", label: "C1 – Lista Geral" },
  { value: "c2", label: "C2 – Desenv. Infantil" },
  { value: "c3", label: "C3 – Gestantes" },
  { value: "c4", label: "C4 – Diabetes" },
  { value: "c5", label: "C5 – Hipertensão" },
  { value: "c6", label: "C6 – Pessoa Idosa" },
  { value: "c7", label: "C7 – PCCU / Prevenção" },
];

export const AuditoriaSection = () => {
  const [loading, setLoading] = useState(false);
  const [quickExporting, setQuickExporting] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [indicatorFilter, setIndicatorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("audit-procedures", { body: payload });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
    return data as AuditResult;
  }, []);

  const fetchRoleMap = useCallback(async () => {
    try {
      // Fetch users and job functions separately to avoid join issues
      const [usersRes, functionsRes] = await Promise.all([
        supabase.from("app_users").select("nome_completo, job_function_id"),
        supabase.from("job_functions").select("id, name")
      ]);
      
      if (usersRes.error || functionsRes.error) return;

      const functionMap: Record<string, string> = {};
      functionsRes.data.forEach(f => {
        functionMap[f.id] = f.name;
      });

      const mapping: Record<string, string> = {};
      usersRes.data.forEach(u => {
        if (u.nome_completo && u.job_function_id) {
          const normalized = u.nome_completo
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/^(DR\.|DRA\.|ENF\.|TEC\.|ACS|AUX\.|VIG\.)\s+/i, "")
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase();
          
          const roleName = functionMap[u.job_function_id];
          if (roleName) mapping[normalized] = roleName;
        }
      });
      setRoleMap(mapping);
    } catch (err) {
      console.error("Error fetching role map:", err);
    }
  }, []);

  useEffect(() => {
    fetchRoleMap();
  }, [fetchRoleMap]);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;
      if (indicatorFilter !== "all") payload.indicator = indicatorFilter;
      const data = await fetchData(payload);
      // Pre-calculate search strings for all records
      data.records = data.records.map(r => ({
        ...r,
        searchString: `${r.professional} ${r.patient} ${r.procedure} ${r.unit} ${r.indicator}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
      }));
      setResult(data);
      toast.success(`${data.total} registros carregados.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao buscar auditoria.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, indicatorFilter, fetchData]);

  const filteredRecords = useMemo(() => {
    if (!result) return [];
    let records = result.records;
    if (unitFilter !== "all") records = records.filter((r) => r.unit === unitFilter);
    if (professionalFilter !== "all") records = records.filter((r) => r.professional === professionalFilter);
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      records = records.filter((r) => r.searchString?.includes(term));
    }
    return records;
  }, [result, unitFilter, professionalFilter, debouncedSearch]);

  const unitOptions = result?.filters.units ?? [];
  const professionalOptions = result?.filters.professionals ?? [];

  const toExportRows = (records: AuditRecord[]) =>
    records.map((r) => ({
      Data: formatDateBR(r.date),
      Profissional: r.professional || "Não informado",
      Procedimento: r.procedure,
      Indicador: r.indicator,
      Tipo: r.source,
      Unidade: r.unit || "-",
      Paciente: r.patient || "-",
    }));

  const handleExportExcel = useCallback(async () => {
    if (!filteredRecords.length) { toast.error("Nenhum registro para exportar."); return; }
    setIsExporting(true);
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        const ws = XLSX.utils.json_to_sheet(toExportRows(filteredRecords));
        ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
        XLSX.writeFile(wb, `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Excel exportado com sucesso.");
      } catch (err) {
        toast.error("Erro ao exportar Excel.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [filteredRecords]);

  const handleExportPdf = useCallback(() => {
    if (!filteredRecords.length) { toast.error("Nenhum registro para exportar."); return; }
    setIsExporting(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text("Auditoria de Procedimentos", 14, 15);
        doc.setFontSize(9);
        doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} – ${filteredRecords.length} registros`, 14, 22);
        autoTable(doc, {
          startY: 28,
          head: [["Data", "Profissional", "Procedimento", "Indicador", "Tipo", "Unidade", "Paciente"]],
          body: filteredRecords.slice(0, 2000).map((r) => [
            formatDateBR(r.date), r.professional || "Não informado", r.procedure, r.indicator, r.source, r.unit || "-", r.patient || "-",
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30, 30, 30] },
        });
        if (filteredRecords.length > 2000) {
          doc.setFontSize(8);
          doc.text(`Nota: Exibindo apenas os primeiros 2000 registros de ${filteredRecords.length} no PDF para evitar lentidão.`, 14, (doc as any).lastAutoTable.finalY + 10);
        }
        doc.save(`auditoria_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("PDF exportado com sucesso.");
      } catch (err) {
        toast.error("Erro ao gerar PDF.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [filteredRecords]);

  const handleExportDashboardPdf = useCallback(() => {
    if (!filteredRecords.length) { toast.error("Nenhum registro para exportar."); return; }
    setIsExporting(true);
    setTimeout(() => {
      try {
        exportAuditDashboardPdf(filteredRecords);
        toast.success("PDF do Dashboard exportado com sucesso.");
      } catch (err) {
        toast.error("Erro ao gerar PDF do Dashboard.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [filteredRecords]);

  const handleQuickExport = useCallback(async () => {
    setQuickExporting(true);
    try {
      const payload: Record<string, unknown> = { limit: 10000 };
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;
      if (indicatorFilter !== "all") payload.indicator = indicatorFilter;
      const data = await fetchData(payload);
      if (!data.records.length) { toast.error("Nenhum registro encontrado."); return; }
      const ws = XLSX.utils.json_to_sheet(toExportRows(data.records));
      ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
      XLSX.writeFile(wb, `auditoria_rapida_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${data.records.length} registros exportados.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na exportação rápida.");
    } finally {
      setQuickExporting(false);
    }
  }, [dateFrom, dateTo, indicatorFilter, fetchData]);

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
      <CardContent className="space-y-5 p-5 md:p-6">
        {/* Filters */}
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card/95 p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filtros</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Auditoria de procedimentos</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleQuickExport} disabled={quickExporting || loading} variant="outline" className="rounded-full px-5" size="lg">
                {quickExporting ? <><Loader2 className="h-4 w-4 animate-spin" />Exportando…</> : <><FileSpreadsheet className="h-4 w-4" />Export. Rápida</>}
              </Button>
              <Button onClick={handleFetch} disabled={loading} className="rounded-full px-6 shadow-lg shadow-accent/20" size="lg">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Carregando…</> : <><RefreshCw className="h-4 w-4" />Atualizar</>}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data início</span>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-12 rounded-2xl border-border bg-background" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data fim</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-12 rounded-2xl border-border bg-background" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Indicador</span>
              <select value={indicatorFilter} onChange={(e) => setIndicatorFilter(e.target.value)} className={selectClassName}>
                {INDICATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Unidade</span>
              <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={selectClassName}>
                <option value="all">Todas as unidades</option>
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Profissional</span>
              <select value={professionalFilter} onChange={(e) => setProfessionalFilter(e.target.value)} className={selectClassName}>
                <option value="all">Todos os profissionais</option>
                {professionalOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Busca livre</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, procedimento…" className="h-12 rounded-2xl border-border bg-background pl-11" />
              </div>
            </label>
          </div>
        </div>

        {/* Summary + export buttons */}
        {result && (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/70 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total carregado</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{result.total.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filtrados</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{filteredRecords.length.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Profissionais</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{professionalOptions.length}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" className="rounded-full" size="sm">
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
                </Button>
                <Button onClick={handleExportPdf} disabled={isExporting} variant="outline" className="rounded-full" size="sm">
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
                </Button>
                <Button onClick={handleExportDashboardPdf} disabled={isExporting} variant="outline" className="rounded-full" size="sm">
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />} PDF Dashboard
                </Button>
              </div>
            </div>

            <Tabs defaultValue="tabela" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="tabela">Tabela</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>

              <TabsContent value="tabela">
                <div className="rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Paciente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhum registro encontrado com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRecords.slice(0, 500).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap font-medium">{formatDateBR(r.date)}</TableCell>
                            <TableCell>{r.professional || <span className="text-muted-foreground italic">Não informado</span>}</TableCell>
                            <TableCell>{r.procedure}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                {r.indicator}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                                {r.source}
                              </span>
                            </TableCell>
                            <TableCell>{r.unit || "-"}</TableCell>
                            <TableCell>{r.patient || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {filteredRecords.length > 500 && (
                    <div className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
                      Exibindo os primeiros 500 de {filteredRecords.length.toLocaleString("pt-BR")} registros. Exporte para ver todos.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="dashboard">
                <AuditDashboard records={filteredRecords} roleMap={roleMap} />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted/30 py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Selecione os filtros e clique em <strong>Atualizar</strong> para carregar os registros, ou use <strong>Export. Rápida</strong> para baixar direto em Excel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
