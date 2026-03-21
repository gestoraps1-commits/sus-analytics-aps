import { useMemo, useState } from "react";
import {
  Baby,
  BarChart3,
  Heart,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndicatorTabDetail } from "@/components/dashboard/IndicatorTabDetail";
import { useIndicatorData, INDICATOR_CONFIGS } from "@/hooks/useIndicatorData";
import { cn } from "@/lib/utils";
import type { IndicatorPatient, ParsedSheet, SearchResult } from "@/types/reference-upload";

type IndicatorDashboardSectionProps = {
  sheets: ParsedSheet[];
  selectedSheetName: string;
  resultsBySheet: Record<string, Record<number, SearchResult>>;
  referenceUploadId: string | null;
  sheetsBySection: Record<string, ParsedSheet | null>;
};

type IndicatorSummary = {
  key: string;
  label: string;
  shortLabel: string;
  icon: typeof Baby;
  color: string;
  patients: IndicatorPatient[];
  isLoading: boolean;
  error: string | null;
};

const SECTION_META: Record<string, { label: string; shortLabel: string; icon: typeof Baby; color: string; target: number; temporalMode?: boolean; flagWeights?: Record<string, number> }> = {
  c2: { label: "C2 · Desenvolvimento Infantil", shortLabel: "C2", icon: Baby, color: "hsl(var(--primary))", target: 80 },
  c3: { label: "C3 · Gestantes e Puérperas", shortLabel: "C3", icon: Heart, color: "hsl(var(--accent))", target: 75, temporalMode: true },
  c4: { label: "C4 · Pessoa com Diabetes", shortLabel: "C4", icon: ShieldCheck, color: "#f59e0b", target: 70 },
  c5: { label: "C5 · Pessoa com Hipertensão", shortLabel: "C5", icon: ShieldCheck, color: "#ef4444", target: 70 },
  c6: { label: "C6 · Pessoa Idosa", shortLabel: "C6", icon: Users, color: "#8b5cf6", target: 65 },
  c7: {
    label: "C7 · PCCU e Prevenção",
    shortLabel: "C7",
    icon: ShieldCheck,
    color: "#06b6d4",
    target: 70,
    flagWeights: { A: 25, B: 20, C: 15, D: 15, E: 10, F: 10, G: 5 },
  },
};

const BAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function computeSummary(patients: IndicatorPatient[]) {
  const total = patients.length;
  if (!total) return { total: 0, completed: 0, withPending: 0, avgScore: 0, completionPct: 0 };
  const completed = patients.filter((p) => p.pendingFlags === 0 && p.trackingFlags === 0).length;
  const withPending = patients.filter((p) => p.pendingFlags > 0).length;
  const avgScore = Math.round(patients.reduce((s, p) => s + p.totalPoints, 0) / total);
  const completionPct = Math.round((completed / total) * 100);
  return { total, completed, withPending, avgScore, completionPct };
}

const tooltipStyle = {
  borderRadius: "1rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  fontSize: "0.75rem",
};

export const IndicatorDashboardSection = ({
  sheets,
  selectedSheetName,
  resultsBySheet,
  referenceUploadId,
  sheetsBySection,
}: IndicatorDashboardSectionProps) => {
  const [unitFilter, setUnitFilter] = useState("all");

  const c2 = useIndicatorData({ config: INDICATOR_CONFIGS.c2, selectedSheet: sheetsBySection.c2 ?? null, results: resultsBySheet[sheetsBySection.c2?.name ?? ""] ?? {}, referenceUploadId });
  const c3 = useIndicatorData({ config: INDICATOR_CONFIGS.c3, selectedSheet: sheetsBySection.c3 ?? null, results: resultsBySheet[sheetsBySection.c3?.name ?? ""] ?? {}, referenceUploadId });
  const c4 = useIndicatorData({ config: INDICATOR_CONFIGS.c4, selectedSheet: sheetsBySection.c4 ?? null, results: resultsBySheet[sheetsBySection.c4?.name ?? ""] ?? {}, referenceUploadId });
  const c5 = useIndicatorData({ config: INDICATOR_CONFIGS.c5, selectedSheet: sheetsBySection.c5 ?? null, results: resultsBySheet[sheetsBySection.c5?.name ?? ""] ?? {}, referenceUploadId });
  const c6 = useIndicatorData({ config: INDICATOR_CONFIGS.c6, selectedSheet: sheetsBySection.c6 ?? null, results: resultsBySheet[sheetsBySection.c6?.name ?? ""] ?? {}, referenceUploadId });
  const c7 = useIndicatorData({ config: INDICATOR_CONFIGS.c7, selectedSheet: sheetsBySection.c7 ?? null, results: resultsBySheet[sheetsBySection.c7?.name ?? ""] ?? {}, referenceUploadId });

  const hooksByKey: Record<string, typeof c2> = { c2, c3, c4, c5, c6, c7 };

  const indicators: IndicatorSummary[] = useMemo(() =>
    Object.entries(SECTION_META).map(([key, meta]) => ({
      key,
      ...meta,
      patients: hooksByKey[key].patients,
      isLoading: hooksByKey[key].isLoading,
      error: hooksByKey[key].error,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [c2, c3, c4, c5, c6, c7]);

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    for (const ind of indicators) for (const p of ind.patients) if (p.unidade) units.add(p.unidade);
    return Array.from(units).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [indicators]);

  const filteredIndicators = useMemo(() =>
    indicators.map((ind) => ({
      ...ind,
      patients: unitFilter === "all" ? ind.patients : ind.patients.filter((p) => p.unidade === unitFilter),
    })),
  [indicators, unitFilter]);

  const indicatorSummaries = useMemo(() => 
    filteredIndicators.map((ind) => ({
      key: ind.key,
      patients: ind.patients,
      summary: computeSummary(ind.patients)
    })),
  [filteredIndicators]);

  const globalKpis = useMemo(() => {
    const activeSummaries = indicatorSummaries.filter(s => s.patients.length > 0);
    const totalAcross = activeSummaries.reduce((sum, s) => sum + s.patients.length, 0);
    
    const uniquePatientsSet = new Set<string>();
    for (const s of activeSummaries) {
      for (const p of s.patients) {
        uniquePatientsSet.add(p.cpf || p.cns || p.nome);
      }
    }
    const uniquePatients = uniquePatientsSet.size;

    const avgCompletion = activeSummaries.length
      ? Math.round(activeSummaries.reduce((sum, s) => sum + s.summary.completionPct, 0) / activeSummaries.length)
      : 0;
    const avgScore = activeSummaries.length
      ? Math.round(activeSummaries.reduce((sum, s) => sum + s.summary.avgScore, 0) / activeSummaries.length)
      : 0;
      
    return { totalAcross, uniquePatients, avgCompletion, avgScore };
  }, [indicatorSummaries]);

  const chartData = useMemo(() =>
    indicatorSummaries.map((s) => ({
      name: SECTION_META[s.key].shortLabel,
      fullName: SECTION_META[s.key].label,
      total: s.summary.total,
      completed: s.summary.completed,
      pending: s.summary.withPending,
      avgScore: s.summary.avgScore,
      completionPct: s.summary.completionPct,
    })),
  [indicatorSummaries]);

  const anyData = filteredIndicators.some((i) => i.patients.length > 0);
  const anyLoading = filteredIndicators.some((i) => i.isLoading);

  if (!referenceUploadId) {
    return (
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Faça upload de uma planilha primeiro para gerar o painel comparativo dos indicadores.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global filter */}
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Filtros globais
          </div>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[260px] rounded-2xl">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {unitOptions.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {anyLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando indicadores…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Overview + per-indicator */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="flex w-full flex-wrap gap-1 bg-muted/50 p-1 rounded-2xl h-auto">
          <TabsTrigger value="overview" className="gap-1.5 rounded-xl text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Visão geral
          </TabsTrigger>
          {Object.entries(SECTION_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5 rounded-xl text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Icon className="h-3.5 w-3.5" />
                {meta.shortLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ────── Overview tab ────── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total de avaliações</p>
              <p className="mt-2 text-2xl font-black text-foreground">{globalKpis.totalAcross}</p>
              <p className="mt-1 text-xs text-muted-foreground">em {filteredIndicators.filter((i) => i.patients.length > 0).length} indicadores</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pacientes únicos</p>
              <p className="mt-2 text-2xl font-black text-foreground">{globalKpis.uniquePatients}</p>
              <p className="mt-1 text-xs text-muted-foreground">identificados nas planilhas</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Conclusão média</p>
              <p className="mt-2 text-2xl font-black text-foreground">{globalKpis.avgCompletion}%</p>
              <p className="mt-1 text-xs text-muted-foreground">pacientes sem pendências</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pontuação média</p>
              <p className="mt-2 text-2xl font-black text-foreground">{globalKpis.avgScore}</p>
              <p className="mt-1 text-xs text-muted-foreground">score médio geral / 100</p>
            </div>
          </div>

          {/* Comparative charts */}
          {anyData && (
            <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
              <CardContent className="space-y-4 p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">Comparativo — Pontuação média</h3>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => name === "avgScore" ? [value, "Pontuação média"] : [value, name]}
                        labelFormatter={(l: string) => chartData.find((d) => d.name === l)?.fullName ?? l}
                      />
                      <Bar dataKey="avgScore" radius={[8, 8, 0, 0]} maxBarSize={64}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {anyData && (
            <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
              <CardContent className="space-y-4 p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">Concluídos vs. Pendentes</h3>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={tooltipStyle}
                        labelFormatter={(l: string) => chartData.find((d) => d.name === l)?.fullName ?? l}
                      />
                      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                      <Bar dataKey="completed" name="Concluídos" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={48} />
                      <Bar dataKey="pending" name="Pendentes" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-indicator summary cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredIndicators.map((ind) => {
              const meta = SECTION_META[ind.key];
              const summary = computeSummary(ind.patients);
              const Icon = meta.icon;
              return (
                <Card key={ind.key} className="overflow-hidden border-border/80 bg-card/90 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}20` }}>
                          <Icon className="h-4 w-4" style={{ color: meta.color }} />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{meta.label}</h4>
                      </div>
                      {ind.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {ind.error && <Badge variant="destructive" className="text-xs">Erro</Badge>}
                    </div>
                    {summary.total > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Pacientes</p>
                            <p className="text-lg font-black text-foreground">{summary.total}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Pontuação média</p>
                            <p className="text-lg font-black text-foreground">{summary.avgScore}/100</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                          <span>Concluídos: {summary.completed}</span>
                          <span>Pendentes: {summary.withPending}</span>
                          <span>{summary.completionPct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">{ind.isLoading ? "Carregando…" : "Sem dados."}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ────── Per-indicator tabs ────── */}
        {Object.entries(SECTION_META).map(([key, meta]) => {
          const filtered = filteredIndicators.find((i) => i.key === key);
          return (
            <TabsContent key={key} value={key}>
              <IndicatorTabDetail
                indicatorKey={key}
                label={meta.label}
                color={meta.color}
                patients={filtered?.patients ?? []}
                isLoading={filtered?.isLoading ?? false}
                error={filtered?.error ?? null}
                target={meta.target}
                flagWeights={meta.flagWeights}
                temporalMode={meta.temporalMode}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
