import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AuditRecord = {
  date: string;
  professional: string;
  procedure: string;
  unit: string;
  patient: string;
  source: string;
  indicator: string;
};

const CHART_COLORS: [number, number, number][] = [
  [59, 130, 246],
  [16, 185, 129],
  [245, 158, 11],
  [239, 68, 68],
  [139, 92, 246],
  [236, 72, 153],
  [20, 184, 166],
  [249, 115, 22],
];

function drawHorizontalBarChart(
  doc: jsPDF,
  data: { name: string; value: number }[],
  x: number,
  y: number,
  width: number,
  title: string,
  color: [number, number, number] = [59, 130, 246]
): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");

  if (!data.length) return y + 10;

  const maxVal = Math.max(...data.map((d) => d.value));
  const labelWidth = 90;
  const barAreaWidth = width - labelWidth - 25;
  const barHeight = 8;
  const rowGap = 11;
  let curY = y + 6;

  data.forEach((item) => {
    const barW = maxVal > 0 ? (item.value / maxVal) * barAreaWidth : 0;

    // Full label - no truncation
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    doc.text(item.name, x, curY + barHeight * 0.6);

    // Bar
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x + labelWidth, curY, Math.max(barW, 2), barHeight - 1, 1.5, 1.5, "F");

    // Value label
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(item.value.toLocaleString("pt-BR"), x + labelWidth + barW + 3, curY + barHeight * 0.6);

    curY += rowGap;
  });

  doc.setTextColor(0, 0, 0);
  return curY + 4;
}

function drawPieChart(
  doc: jsPDF,
  data: { name: string; value: number }[],
  cx: number,
  cy: number,
  radius: number,
  title: string
): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, cx - radius, cy - radius - 10);
  doc.setFont("helvetica", "normal");

  if (!data.length) return cy + radius + 10;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return cy + radius + 10;

  let startAngle = -Math.PI / 2;

  data.forEach((item, i) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const c = CHART_COLORS[i % CHART_COLORS.length];

    doc.setFillColor(c[0], c[1], c[2]);
    const steps = Math.max(Math.ceil(sliceAngle / 0.04), 4);
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * sliceAngle;
      const a2 = startAngle + ((s + 1) / steps) * sliceAngle;
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);
      doc.triangle(cx, cy, x1, y1, x2, y2, "F");
    }

    // Legend
    const legendX = cx + radius + 15;
    const legendY = cy - radius + i * 11;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(legendX, legendY, 5, 5, "F");
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    const pct = ((item.value / total) * 100).toFixed(1);
    doc.text(`${item.name} (${pct}%)`, legendX + 7, legendY + 4);

    startAngle = endAngle;
  });

  doc.setTextColor(0, 0, 0);
  return cy + radius + 15;
}

function drawLineChart(
  doc: jsPDF,
  data: { name: string; value: number }[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");

  if (data.length < 2) return y + height;

  const maxVal = Math.max(...data.map((d) => d.value));
  const chartX = x + 18;
  const chartW = width - 25;
  const chartH = height - 25;
  const chartY = y + 8;

  // Axes
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(chartX, chartY, chartX, chartY + chartH);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  // Grid lines + Y labels
  for (let g = 0; g <= 4; g++) {
    const gy = chartY + (g / 4) * chartH;
    doc.setDrawColor(235, 235, 235);
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    const val = Math.round(maxVal - (g / 4) * maxVal);
    doc.text(val.toString(), x, gy + 1.5);
  }

  // Line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.7);
  const points = data.map((d, i) => ({
    px: chartX + (i / (data.length - 1)) * chartW,
    py: chartY + chartH - (d.value / (maxVal || 1)) * chartH,
  }));
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].px, points[i].py, points[i + 1].px, points[i + 1].py);
  }

  // X-axis labels
  doc.setFontSize(5);
  doc.setTextColor(100, 100, 100);
  const step = Math.max(1, Math.floor(data.length / 10));
  for (let i = 0; i < data.length; i += step) {
    doc.text(data[i].name, points[i].px - 3, chartY + chartH + 5);
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setTextColor(0, 0, 0);
  return y + height + 5;
}

export function exportAuditDashboardPdf(records: AuditRecord[]) {
  try {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();

    // ============ PAGE 1: Header + KPIs ============
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Dashboard de Auditoria — Resumo Analítico", 14, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} – ${records.length.toLocaleString("pt-BR")} registros`, 14, 22);

    // KPI computation - Single pass
    const stats = {
      uniqueDates: new Set<string>(),
      uniqueProfessionals: new Set<string>(),
      uniqueUnits: new Set<string>(),
      indicatorMap: {} as Record<string, number>,
      unitMap: {} as Record<string, number>,
      sourceMap: {} as Record<string, number>,
      profMap: {} as Record<string, number>,
      dailyMap: {} as Record<string, number>
    };

    records.forEach((r) => {
      if (r.date) {
        stats.uniqueDates.add(r.date);
        stats.dailyMap[r.date] = (stats.dailyMap[r.date] || 0) + 1;
      }
      if (r.professional) {
        stats.uniqueProfessionals.add(r.professional);
        stats.profMap[r.professional] = (stats.profMap[r.professional] || 0) + 1;
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

    autoTable(doc, {
      startY: 28,
      head: [["KPI", "Valor"]],
      body: [
        ["Total de Procedimentos", records.length.toLocaleString("pt-BR")],
        ["Média por Dia", stats.uniqueDates.size ? Math.round(records.length / stats.uniqueDates.size).toLocaleString("pt-BR") : "0"],
        ["Profissionais Únicos", stats.uniqueProfessionals.size.toLocaleString("pt-BR")],
        ["Unidades Únicas", stats.uniqueUnits.size.toLocaleString("pt-BR")],
        ["Top Indicador", topIndicator ? `${topIndicator[0]} (${topIndicator[1]})` : "-"],
        ["Cobertura de Indicadores", `${coverage}/7 (${Math.round((coverage / 7) * 100)}%)`],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] },
      theme: "grid",
    });

    // ============ PAGE 2: By Indicator + By Source ============
    doc.addPage();

    const byIndicator = indicatorEntries.map(([name, value]) => ({ name, value }));
    const endY1 = drawHorizontalBarChart(doc, byIndicator, 14, 18, pageW / 2 - 20, "Procedimentos por Indicador", [59, 130, 246]);

    // By Source - Pie
    const bySource = Object.entries(stats.sourceMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    drawPieChart(doc, bySource, pageW / 2 + 50, 55, 28, "Distribuição por Tipo");

    // Daily Volume
    const dailyVolume = Object.entries(stats.dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => {
        const parts = date.split("-");
        return { name: parts.length === 3 ? `${parts[2]}/${parts[1]}` : date, value };
      });

    const lineY = Math.max(endY1, 100) + 5;
    drawLineChart(doc, dailyVolume, 14, lineY, pageW - 28, 60, "Volume Diário");

    // ============ PAGE 3: Units + Professionals Charts ============
    doc.addPage();

    const byUnit = Object.entries(stats.unitMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
    const unitsEndY = drawHorizontalBarChart(doc, byUnit, 14, 18, pageW - 28, "Top 10 Unidades", [16, 185, 129]);

    const byProf = Object.entries(stats.profMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, value]) => ({ name, value }));
    const profStartY = unitsEndY + 5;
    // Check if we need a new page
    if (profStartY + byProf.length * 11 > 190) {
      doc.addPage();
      drawHorizontalBarChart(doc, byProf, 14, 18, pageW - 28, "Top 15 Profissionais", [139, 92, 246]);
    } else {
      drawHorizontalBarChart(doc, byProf, 14, profStartY, pageW - 28, "Top 15 Profissionais", [139, 92, 246]);
    }

    // ============ DETAIL TABLES ============
    doc.addPage();
    let currentY = 15;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Procedimentos por Indicador", 14, currentY);
    autoTable(doc, {
      startY: currentY + 4,
      head: [["Indicador", "Quantidade", "% do Total"]],
      body: indicatorEntries.map(([name, count]) => [
        name, count.toLocaleString("pt-BR"), `${((count / records.length) * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50] },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 10 || 90;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Top 15 Unidades", 14, currentY);
    autoTable(doc, {
      startY: currentY + 4,
      head: [["Unidade", "Quantidade", "% do Total"]],
      body: byUnit.map(({ name, value }) => [name, value.toLocaleString("pt-BR"), `${((value / records.length) * 100).toFixed(1)}%`]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50] },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 10 || 150;
    if (currentY > 150) { doc.addPage(); currentY = 15; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Top 20 Profissionais", 14, currentY);
    autoTable(doc, {
      startY: currentY + 4,
      head: [["Profissional", "Quantidade", "% do Total"]],
      body: Object.entries(stats.profMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => [
        name, count.toLocaleString("pt-BR"), `${((count / records.length) * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50] },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 10 || 150;
    if (currentY > 160) { doc.addPage(); currentY = 15; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Distribuição por Tipo", 14, currentY);
    autoTable(doc, {
      startY: currentY + 4,
      head: [["Tipo", "Quantidade", "% do Total"]],
      body: bySource.map(({ name, value }) => [name, value.toLocaleString("pt-BR"), `${((value / records.length) * 100).toFixed(1)}%`]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50] },
    });

    doc.save(`dashboard_auditoria_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("Erro ao gerar PDF do dashboard:", err);
    throw err;
  }
}
