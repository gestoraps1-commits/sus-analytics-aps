import { useMemo } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { IndicatorFlag, IndicatorPatient } from "@/types/reference-upload";

export type IndicatorTabDetailProps = {
  indicatorKey: string;
  label: string;
  color: string;
  patients: IndicatorPatient[];
  isLoading: boolean;
  error: string | null;
  /** Meta de pontuação (0-100) */
  target: number;
  /** Pesos por flag key para C7 ponderado */
  flagWeights?: Record<string, number>;
  /** Temporal mode para C3 – agrupa por mês de DUM/DPP */
  temporalMode?: boolean;
};

/* ─────── helpers ─────── */

const tooltipStyle = {
  borderRadius: "1rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  fontSize: "0.75rem",
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function computeSubItemCoverage(patients: IndicatorPatient[], flagWeights?: Record<string, number>) {
  const flagMap = new Map<string, { key: string; title: string; done: number; total: number; weight: number }>();

  for (const p of patients) {
    for (const f of p.flags) {
      const existing = flagMap.get(f.key) ?? { key: f.key, title: f.title, done: 0, total: 0, weight: flagWeights?.[f.key] ?? f.points };
      existing.total++;
      if (f.completed || f.status === "done") existing.done++;
      flagMap.set(f.key, existing);
    }
  }

  return Array.from(flagMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function computeRankingByUnit(patients: IndicatorPatient[]) {
  const map = new Map<string, { total: number; completed: number; sumScore: number }>();
  for (const p of patients) {
    const unit = p.unidade || "Sem unidade";
    const e = map.get(unit) ?? { total: 0, completed: 0, sumScore: 0 };
    e.total++;
    if (p.pendingFlags === 0 && p.trackingFlags === 0) e.completed++;
    e.sumScore += p.totalPoints;
    map.set(unit, e);
  }
  return Array.from(map.entries())
    .map(([unit, v]) => ({
      name: unit,
      total: v.total,
      completed: v.completed,
      avgScore: v.total ? Math.round(v.sumScore / v.total) : 0,
      completionPct: pct(v.completed, v.total),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function computeRankingByProfessional(patients: IndicatorPatient[]) {
  const map = new Map<string, { total: number; completed: number; sumScore: number }>();
  for (const p of patients) {
    // Use events from flags to extract professionals
    const professionals = new Set<string>();
    for (const f of p.flags) {
      if (f.events) {
        for (const ev of f.events) {
          if (ev.professional) professionals.add(ev.professional);
        }
      }
    }
    if (professionals.size === 0) professionals.add(p.equipe || "Sem profissional");
    for (const prof of professionals) {
      const e = map.get(prof) ?? { total: 0, completed: 0, sumScore: 0 };
      e.total++;
      if (p.pendingFlags === 0 && p.trackingFlags === 0) e.completed++;
      e.sumScore += p.totalPoints;
      map.set(prof, e);
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name: name.length > 28 ? name.slice(0, 26) + "…" : name,
      total: v.total,
      completed: v.completed,
      avgScore: v.total ? Math.round(v.sumScore / v.total) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 15);
}

/** Simula tendência agrupando por classificação e distribuição */
function computeTrendData(patients: IndicatorPatient[], temporalMode: boolean) {
  if (temporalMode) {
    // For C3, group by gestational month from nascimento/deadline
    const monthMap = new Map<string, { total: number; completed: number; sumScore: number }>();
    for (const p of patients) {
      // Use the first flag deadline or fallback to patient nascimento
      const dateStr = p.flags.find((f) => f.deadline?.date)?.deadline?.date ?? p.nascimento;
      if (!dateStr) continue;
      const d = new Date(dateStr + "T00:00:00Z");
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const e = monthMap.get(key) ?? { total: 0, completed: 0, sumScore: 0 };
      e.total++;
      if (p.pendingFlags === 0 && p.trackingFlags === 0) e.completed++;
      e.sumScore += p.totalPoints;
      monthMap.set(key, e);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        label: month,
        avgScore: v.total ? Math.round(v.sumScore / v.total) : 0,
        completed: v.completed,
        total: v.total,
      }));
  }

  // Default: group by classification bucket
  const classOrder: Array<IndicatorPatient["classification"]> = ["regular", "suficiente", "bom", "otimo"];
  const classLabels: Record<string, string> = { regular: "Regular", suficiente: "Suficiente", bom: "Bom", otimo: "Ótimo" };
  return classOrder.map((cls) => {
    const group = patients.filter((p) => p.classification === cls);
    return {
      label: classLabels[cls],
      avgScore: group.length ? Math.round(group.reduce((s, p) => s + p.totalPoints, 0) / group.length) : 0,
      completed: group.filter((p) => p.pendingFlags === 0 && p.trackingFlags === 0).length,
      total: group.length,
    };
  });
}

/** Potential gain: sum of missed points across all patients */
function computePotentialGain(patients: IndicatorPatient[], flagWeights?: Record<string, number>) {
  let totalMissed = 0;
  let totalPossible = 0;
  for (const p of patients) {
    for (const f of p.flags) {
      const weight = flagWeights?.[f.key] ?? f.points;
      totalPossible += weight;
      if (!f.completed && f.status !== "done") {
        totalMissed += weight;
      }
    }
  }
  return { totalMissed, totalPossible, recoveryPct: pct(totalMissed, totalPossible) };
}

/* ─────── component ─────── */

export const IndicatorTabDetail = ({
  indicatorKey,
  label,
  color,
  patients,
  isLoading,
  error,
  target,
  flagWeights,
  temporalMode = false,
}: IndicatorTabDetailProps) => {
  const total = patients.length;
  const completed = useMemo(() => patients.filter((p) => p.pendingFlags === 0 && p.trackingFlags === 0).length, [patients]);
  const withPending = useMemo(() => patients.filter((p) => p.pendingFlags > 0).length, [patients]);
  const avgScore = useMemo(() => (total ? Math.round(patients.reduce((s, p) => s + p.totalPoints, 0) / total) : 0), [patients, total]);
  const gap = Math.max(0, target - avgScore);
  const completionPct = pct(completed, total);

  const subItemCoverage = useMemo(() => computeSubItemCoverage(patients, flagWeights), [patients, flagWeights]);
  const unitRanking = useMemo(() => computeRankingByUnit(patients), [patients]);
  const profRanking = useMemo(() => computeRankingByProfessional(patients), [patients]);
  const trendData = useMemo(() => computeTrendData(patients, temporalMode), [patients, temporalMode]);
  const potentialGain = useMemo(() => computePotentialGain(patients, flagWeights), [patients, flagWeights]);

  if (isLoading && !total) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando dados do indicador…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!total) {
    return (
      <Card className="border-border/80 bg-card/90">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Sem dados disponíveis para {label}. Verifique se a aba correta foi enviada no upload.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Resultado atual" value={`${avgScore}/100`} sub={`Meta: ${target}`} color={color} />
        <KpiCard label="Meta" value={`${target}`} sub="pontos" />
        <KpiCard label="Gap" value={`${gap}`} sub={gap === 0 ? "Meta atingida ✓" : `faltam ${gap} pts`} alert={gap > 20} />
        <KpiCard label="Elegíveis" value={`${total}`} sub="pacientes na lista" />
        <KpiCard label="Concluídos" value={`${completed}`} sub={`${completionPct}% do total`} />
        <KpiCard label="Pendentes" value={`${withPending}`} sub={`${pct(withPending, total)}% do total`} alert={withPending > total * 0.3} />
      </div>

      {/* Sub-item coverage */}
      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Cobertura por subitem {flagWeights ? "(ponderado)" : ""}
          </h4>
          <div className="space-y-3">
            {subItemCoverage.map((item) => {
              const covPct = pct(item.done, item.total);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{item.key} · {item.title}</span>
                    <span className="text-muted-foreground">
                      {item.done}/{item.total} ({covPct}%)
                      {flagWeights ? ` — peso ${item.weight}` : ""}
                    </span>
                  </div>
                  <Progress value={covPct} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ranking by unit */}
        {unitRanking.length > 0 && (
          <Card className="border-border/80 bg-card/90 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                <Award className="h-4 w-4" />
                Ranking por unidade
              </h4>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitRanking.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}/100`, "Pontuação média"]} />
                    <Bar dataKey="avgScore" fill={color} radius={[0, 6, 6, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking by professional */}
        {profRanking.length > 0 && (
          <Card className="border-border/80 bg-card/90 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                <Users className="h-4 w-4" />
                Ranking por profissional
              </h4>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profRanking.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}/100`, "Pontuação média"]} />
                    <Bar dataKey="avgScore" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trend / temporal */}
      {trendData.length > 1 && (
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              {temporalMode ? "Tendência temporal (mês)" : "Distribuição por classificação"}
            </h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                {temporalMode ? (
                  <LineChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="avgScore" name="Pontuação média" stroke={color} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="completed" name="Concluídos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                  </LineChart>
                ) : (
                  <BarChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
                    <Bar dataKey="total" name="Total" fill={color} radius={[6, 6, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="completed" name="Concluídos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Potential gain */}
      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-6 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10">
              <ArrowUpRight className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Ganho potencial</p>
              <p className="text-lg font-black text-foreground">{potentialGain.totalMissed} pts</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground leading-5">
            <span className="font-semibold text-foreground">{potentialGain.recoveryPct}%</span> dos pontos totais ({potentialGain.totalPossible}) ainda podem ser recuperados
            se os procedimentos pendentes forem realizados dentro do prazo.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─────── small KPI card ─────── */

function KpiCard({ label, value, sub, color, alert }: { label: string; value: string; sub: string; color?: string; alert?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 shadow-sm",
      alert ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/90",
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
