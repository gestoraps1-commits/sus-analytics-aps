import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Activity, Users, Building2, TrendingUp, BarChart3, Layers } from "lucide-react";

type AuditRecord = {
  date: string;
  professional: string;
  procedure: string;
  unit: string;
  patient: string;
  source: string;
  indicator: string;
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(35, 85%, 55%)",
  "hsl(330, 65%, 55%)",
  "hsl(270, 55%, 55%)",
  "hsl(190, 65%, 45%)",
];

interface Props {
  records: AuditRecord[];
  roleMap?: Record<string, string>;
}

export function AuditDashboard({ records, roleMap = {} }: Props) {
  const data = useMemo(() => {
    if (!records.length) return null;

    const stats = {
      uniqueDates: new Set<string>(),
      uniqueProfessionals: new Set<string>(),
      uniqueUnits: new Set<string>(),
      indicatorMap: {} as Record<string, number>,
      unitMap: {} as Record<string, number>,
      dailyMap: {} as Record<string, number>,
      sourceMap: {} as Record<string, number>,
      professionalMap: {} as Record<string, number>,
    };

    records.forEach((r) => {
      if (r.date) {
        stats.uniqueDates.add(r.date);
        stats.dailyMap[r.date] = (stats.dailyMap[r.date] || 0) + 1;
      }
      if (r.professional) {
        stats.uniqueProfessionals.add(r.professional);
        stats.professionalMap[r.professional] = (stats.professionalMap[r.professional] || 0) + 1;
      }
      if (r.unit) {
        stats.uniqueUnits.add(r.unit);
        stats.unitMap[r.unit] = (stats.unitMap[r.unit] || 0) + 1;
      }
      if (r.indicator) {
        stats.indicatorMap[r.indicator] = (stats.indicatorMap[r.indicator] || 0) + 1;
      }
      if (r.source) {
        stats.sourceMap[r.source] = (stats.sourceMap[r.source] || 0) + 1;
      }
    });

    const indicatorEntries = Object.entries(stats.indicatorMap).sort((a, b) => b[1] - a[1]);
    const topIndicator = indicatorEntries[0];
    const allIndicators = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];
    const coverage = allIndicators.filter((i) =>
      Object.keys(stats.indicatorMap).some((k) => k.toUpperCase().startsWith(i))
    ).length;

    const byProfessional = Object.entries(stats.professionalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, value]) => {
        const normalized = name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/^(DR\.|DRA\.|ENF\.|TEC\.|ACS|AUX\.|VIG\.)\s+/i, "")
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase();
        
        let role = roleMap[normalized];
        if (!role) {
          const sysNameEntry = Object.entries(roleMap).find(([sysName]) => {
            if (sysName.length < 5 || normalized.length < 5) return false;
            return sysName.includes(normalized) || normalized.includes(sysName);
          });
          if (sysNameEntry) role = sysNameEntry[1];
        }

        return { 
          name, 
          displayName: role ? `${name} (${role})` : name,
          value 
        };
      });

    return {
      kpis: {
        total: records.length,
        avgPerDay: stats.uniqueDates.size ? Math.round(records.length / stats.uniqueDates.size) : 0,
        professionals: stats.uniqueProfessionals.size,
        units: stats.uniqueUnits.size,
        topIndicator: topIndicator ? topIndicator[0] : "-",
        coverage: `${coverage}/7 (${Math.round((coverage / 7) * 100)}%)`,
      },
      byIndicator: indicatorEntries.map(([name, value]) => ({ name, value })),
      byUnit: Object.entries(stats.unitMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, value]) => ({ name, value })),
      dailyVolume: Object.entries(stats.dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => {
        const [y, m, d] = date.split("-");
        return { name: `${d}/${m}`, value };
      }),
      bySource: Object.entries(stats.sourceMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
      byProfessional,
    };
  }, [records, roleMap]);

  if (!records.length || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted/30 py-16">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Carregue os dados na aba Tabela para visualizar o dashboard.</p>
      </div>
    );
  }

  const kpiCards = [
    { icon: Activity, label: "Total Procedimentos", value: data.kpis.total.toLocaleString("pt-BR") },
    { icon: TrendingUp, label: "Média / Dia", value: data.kpis.avgPerDay.toLocaleString("pt-BR") },
    { icon: Users, label: "Profissionais", value: data.kpis.professionals.toLocaleString("pt-BR") },
    { icon: Building2, label: "Unidades", value: data.kpis.units.toLocaleString("pt-BR") },
    { icon: BarChart3, label: "Top Indicador", value: data.kpis.topIndicator },
    { icon: Layers, label: "Cobertura", value: data.kpis.coverage },
  ];

  // Dynamic height based on item count
  const unitChartHeight = Math.max(200, data.byUnit.length * 40);
  const profChartHeight = Math.max(250, data.byProfessional.length * 36);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border bg-background/70 p-4 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <kpi.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-xl font-black text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Indicator */}
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Procedimentos por Indicador</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.byIndicator} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Source (Pie) */}
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Distribuição por Tipo</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.bySource} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {data.bySource.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Volume */}
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Volume Diário</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailyVolume} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top 20 Units */}
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Top 20 Unidades</h4>
          <ResponsiveContainer width="100%" height={unitChartHeight}>
            <BarChart data={data.byUnit} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" width={220} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
              <Bar dataKey="value" fill="hsl(210, 70%, 55%)" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 20 Professionals */}
      <div className="rounded-2xl border border-border bg-background/70 p-5">
        <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Top 20 Profissionais</h4>
        <ResponsiveContainer width="100%" height={profChartHeight}>
          <BarChart data={data.byProfessional} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis dataKey="displayName" type="category" width={320} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip 
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(value, name, props) => [value, "Procedimentos"]}
              labelFormatter={(label, payload) => payload[0]?.payload?.name || label}
            />
            <Bar dataKey="value" fill="hsl(150, 60%, 45%)" radius={[0, 6, 6, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
